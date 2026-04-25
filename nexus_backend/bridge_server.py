import os
import json
import asyncio
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import chromadb
import ollama
import threading
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="NEXUS RAG Bridge Server")

# CORS設定 (Electronからのアクセスを許可)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 設定 ---
DB_PATH = os.path.join(os.path.dirname(__file__), "nexus_db")
COLLECTION_NAME = "nexus_novels"

# ChromaDBのセットアップ
client = chromadb.PersistentClient(path=DB_PATH)
collection = client.get_or_create_collection(name=COLLECTION_NAME)

# グローバルな監査状態
audit_status = {"running": False, "progress": "", "completed": False}

def run_audit_background():
    global audit_status
    try:
        from audit_batch_processor import AuditBatchProcessor
        processor = AuditBatchProcessor()
        audit_status["progress"] = "データベース同期中..."
        processor.run_full_audit()
        audit_status = {"running": False, "progress": "完了", "completed": True}
    except Exception as e:
        import traceback
        traceback.print_exc()
        audit_status = {"running": False, "progress": f"エラー: {e}", "completed": False}

class AskRequest(BaseModel):
    query: str
    model: str = "qwen3.5:9b"
    system_prompt: str = ""

@app.post("/ask")
async def ask_rag(request: AskRequest):
    """
    RAG検索を行い、Ollamaの回答を非同期ストリーミングで返す
    """
    query = request.query
    model_name = request.model

    from knowledge_processor import KnowledgeProcessor
    kp = KnowledgeProcessor()

    try:
        print(f"💬 Received query: {query} (Model: {model_name})")
        async_client = ollama.AsyncClient()
        
        # 1. キーワード抽出
        keywords = kp.extract_keywords(query)
        
        # 2. 検索実行
        # ベクトル検索
        response_vector = await async_client.embeddings(model="nomic-embed-text", prompt=query)
        vector_results = collection.query(
            query_embeddings=[response_vector["embedding"]], 
            n_results=10
        )
        
        # 3. ランキング
        all_candidates = {}
        if vector_results['documents'] and vector_results['documents'][0]:
            for i, (doc, meta, doc_id) in enumerate(zip(vector_results['documents'][0], vector_results['metadatas'][0], vector_results['ids'][0])):
                score = (10 - i) + (meta.get('importance', 50) / 10)
                all_candidates[doc_id] = [doc, meta, score]

        sorted_candidates = sorted(all_candidates.values(), key=lambda x: x[2], reverse=True)[:8]
        
        # 4. コンテキスト構築 (XML形式)
        context_parts = []
        for i, (doc, meta, score) in enumerate(sorted_candidates):
            file_name = meta.get('file', '不明')
            importance = meta.get('importance', 50)
            doc_type = meta.get('doc_type', 'OTHER')
            project = meta.get('project', 'Unknown')
            path = meta.get('path', '')
            
            try:
                rel_data = json.loads(meta.get('relationships', '[]'))
                rel_xml = "".join([f'      <relation subject="{r["subject"]}" predicate="{r["predicate"]}" type="{r["type"]}" />\n' for r in rel_data])
            except:
                rel_xml = ""

            memory_xml = f"""    <memory index="{i+1}" type="{doc_type}" importance="{importance}" project="{project}">
      <source>{file_name}</source>
      <path>{path}</path>
      <relationships>
{rel_xml}      </relationships>
      <content>
{doc}
      </content>
    </memory>"""
            context_parts.append(memory_xml)
        
        wrapped_context = f"<creation_memory>\n" + "\n".join(context_parts) + "\n</creation_memory>"
        
        # 5. システムプロンプト構築
        base_system_prompt = """あなたは小説執筆の「物語整合性アドバイザー」兼「外部記憶エンジン」です。
提供された <creation_memory> 内の資料を元に、作者の質問に答えてください。

【記憶の扱いルール】
1. <memory> タグの type 属性に注目してください。
   - type="PLOT": 作品の「設計図」です。これに書かれている展開を最優先の真実としてください。
   - type="SETTING": 設定資料です。固有名詞の定義やキャラクターの属性（A=B）を正確に守ってください。
   - type="MANUSCRIPT": 実際の原稿です。過去にどのように描写されたかの「事実」として参照してください。
2. importance (0-100) が高いものほど、現在の物語における優先度が高い「最新の設定」です。
3. 資料間に矛盾がある場合は、importance が高い方、または type="PLOT" の内容を優先し、矛盾があることを作者に指摘してください。
4. 資料に書かれていないことを推測する場合は、「資料にはありませんが、文脈からの推測では〜」と明示してください。
5. 固有名詞や独自用語は、<relationships> 内の定義を正確に引用してください。"""

        final_system_prompt = f"{request.system_prompt}\n\n{base_system_prompt}" if request.system_prompt else base_system_prompt

        prompt = f"以下の <creation_memory> を解析し、著者の執筆を支援してください。\n\n{wrapped_context}\n\n【質問】\n{query}"

        # 6. 非同期ジェネレータ
        async def generate():
            print("🚀 Starting Ollama chat stream...")
            try:
                async for chunk in await async_client.chat(
                    model=model_name,
                    messages=[
                        {'role': 'system', 'content': final_system_prompt},
                        {'role': 'user', 'content': prompt},
                    ],
                    stream=True
                ):
                    data = {
                        "message": { "content": chunk['message']['content'] },
                        "done": chunk.get('done', False)
                    }
                    yield json.dumps(data) + "\n"
            except Exception as e:
                print(f"❌ Streaming error: {e}")
                yield json.dumps({"error": str(e)}) + "\n"

        return StreamingResponse(generate(), media_type="application/x-ndjson")

    except Exception as e:
        print(f"❌ Error in ask_rag: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/db/update_tags")
async def update_tags(request: Request):
    try:
        data = await request.json()
        full_path = data.get("full_path")
        tags = data.get("tags", [])
        
        config_path = os.path.join(os.path.dirname(__file__), "db_config.json")
        config = {}
        if os.path.exists(config_path):
            with open(config_path, "r", encoding="utf-8") as f: config = json.load(f)
        
        if "tags" not in config: config["tags"] = {}
        config["tags"][full_path] = tags
        
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(config, f, ensure_ascii=False, indent=2)
            
        results = collection.get(where={"full_path": full_path})
        if results['ids']:
            new_metadatas = []
            for meta in results['metadatas']:
                meta['tags'] = ",".join(tags)
                new_metadatas.append(meta)
            collection.update(ids=results['ids'], metadatas=new_metadatas)
            
        return {"success": True, "tags": tags}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/reference_sheet")
async def generate_reference_sheet(request: AskRequest):
    query = request.query
    try:
        async_client = ollama.AsyncClient()
        response_vector = await async_client.embeddings(model="nomic-embed-text", prompt=query)
        results = collection.query(query_embeddings=[response_vector["embedding"]], n_results=10)
        
        context_parts = []
        if results['documents'] and results['documents'][0]:
            for i, (doc, meta) in enumerate(zip(results['documents'][0], results['metadatas'][0])):
                file_name = meta.get('file', '不明')
                importance = meta.get('importance', 50)
                doc_type = meta.get('doc_type', 'OTHER')
                
                try:
                    rel_data = json.loads(meta.get('relationships', '[]'))
                    rel_xml = "".join([f'      <relation subject="{r["subject"]}" predicate="{r["predicate"]}" />\n' for r in rel_data])
                except: rel_xml = ""

                memory_xml = f"""    <memory type="{doc_type}" importance="{importance}">
      <source>{file_name}</source>
      <relationships>
{rel_xml}      </relationships>
      <content>
{doc}
      </content>
    </memory>"""
                context_parts.append(memory_xml)

        sheet = f"""あなたは小説執筆の「物語整合性アドバイザー」です。
以下の著者から提供された <creation_memory> を完璧に把握し、執筆を支援してください。
type="PLOT" の記述を最優先の真実とし、importance が高いものほど最新の設定です。

<creation_memory>
{"\n".join(context_parts)}
</creation_memory>

著者からの指示: {query}"""
        return {"sheet": sheet}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/db/items")
async def list_db_items():
    try:
        results = collection.get(include=['metadatas', 'documents'])
        files_map = {}
        for i, meta in enumerate(results['metadatas']):
            full_path = meta.get('full_path')
            if not full_path: continue
            if full_path not in files_map:
                tag_list = [t.strip() for t in meta.get('tags', '').split(',') if t.strip()]
                entities = meta.get('entities', '')
                if entities:
                    for entity in entities.split(','):
                        if entity.strip() and entity.strip() not in tag_list:
                            tag_list.append(entity.strip())
                
                files_map[full_path] = {
                    "file": meta.get('file'),
                    "path": meta.get('path'),
                    "full_path": full_path,
                    "preview": results['documents'][i][:150] + "...",
                    "tags": tag_list,
                    "importance": meta.get('importance', 50),
                    "project": meta.get('project', 'Unknown'),
                    "doc_type": meta.get('doc_type', 'OTHER')
                }
        return sorted(list(files_map.values()), key=lambda x: x['file'])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/proofread")
async def combined_proofread(request: AskRequest):
    """
    ルールベース（プログラム）と AI を組み合わせたハイブリッド校正を実行する
    """
    text = request.query
    from proofreader import Proofreader
    from knowledge_processor import KnowledgeProcessor
    
    pr = Proofreader()
    kp = KnowledgeProcessor()
    
    # 1. ルールベース校正 (一瞬)
    static_corrections = pr.proofread(text)
    static_xml = pr.to_xml(static_corrections)
    
    # 2. AI校正 (物語監査)
    # 負荷を減らすため、AIには「物語の矛盾」だけに集中させる
    async_client = ollama.AsyncClient()
    
    # RAGで設定資料を検索
    response_vector = await async_client.embeddings(model="nomic-embed-text", prompt=text[:500]) # 冒頭500文字で検索
    results = collection.query(query_embeddings=[response_vector["embedding"]], n_results=5)
    
    context_parts = []
    if results['documents'] and results['documents'][0]:
        for i, (doc, meta) in enumerate(zip(results['documents'][0], results['metadatas'][0])):
            context_parts.append(f'<memory type="{meta.get("doc_type")}" source="{meta.get("file")}">{doc}</memory>')
    
    context = "\n".join(context_parts)
    
    system_prompt = """あなたは小説の物語監査官です。
提供された <creation_memory>（設定資料）と照らし合わせ、提示されたテキストに「設定矛盾」がないかチェックしてください。
文章校正（誤字脱字など）は既に別のプログラムで実施済みなので、あなたは【設定の矛盾】だけに集中してください。

矛盾を発見した場合は、必ず以下の形式で出力してください。
<correction>
<original>矛盾している箇所の原文</original>
<suggested>設定に合わせた修正案</suggested>
<reason>なぜ矛盾しているのか（どの資料と食い違っているか）</reason>
</correction>

矛盾がない場合は、何も出力しないでください。"""

    prompt = f"<creation_memory>\n{context}\n</creation_memory>\n\n【対象テキスト】\n{text}"

    # AI 実行 (ストリーミングなしで一括取得してマージ)
    try:
        response = await async_client.chat(
            model=request.model,
            messages=[
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': prompt}
            ]
        )
        ai_xml = response['message']['content']
    except:
        ai_xml = ""

    # 両方の結果を統合して返却
    # フロントエンドが <correction> タグをパースできるよう、単に結合して返す
    return {"corrections": static_xml + ai_xml}

@app.post("/analyze/audit/start")
async def start_full_audit(background_tasks: BackgroundTasks):
    """
    全原稿の校正監査（バッチ処理）を非同期で開始する
    """
    global audit_status
    if audit_status["running"]:
        return {"status": "already_running", "message": "監査は既に実行中です。"}
    
    audit_status = {"running": True, "progress": "開始準備中...", "completed": False}
    background_tasks.add_task(run_audit_background)
    return {"status": "started", "message": "監査を開始しました。"}

@app.get("/analyze/audit/status")
async def get_audit_status():
    """
    現在の監査進捗を取得する
    """
    return audit_status

@app.get("/analyze/audit/report")
async def get_audit_report():
    """
    監査済みの宿題リストを取得する
    """
    report_path = os.path.join(os.path.dirname(__file__), "homework_list.json")
    if os.path.exists(report_path):
        with open(report_path, "r", encoding="utf-8") as f:
            return json.load(f)
    return []

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
