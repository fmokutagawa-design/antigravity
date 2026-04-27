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

# 監査の進捗管理用グローバル変数
audit_state = {
    "running": False,
    "progress": "",
    "completed": False,
    "total_files": 0,
    "current_file": 0
}

class AskRequest(BaseModel):
    query: str
    model: str = "qwen3.5:9b"
    system_prompt: str = ""
    file_path: str = ""

@app.post("/ask")
async def ask_rag(request: AskRequest):
    """
    RAG検索を行い、Ollamaの回答を非同期ストリーミングで返す
    """
    query = request.query
    model_name = request.model
    file_path = request.file_path

    from knowledge_processor import KnowledgeProcessor
    kp = KnowledgeProcessor()
    project_id = kp._determine_project(file_path) if file_path else "Unknown"

    try:
        print(f"💬 Query: {query} (Project: {project_id})")
        async_client = ollama.AsyncClient()
        
        # 1. 検索実行 (プロジェクト限定)
        response_vector = await async_client.embeddings(model="nomic-embed-text", prompt=query)
        
        where_clause = {"project": project_id} if project_id != "Unknown" else None
        
        vector_results = collection.query(
            query_embeddings=[response_vector["embedding"]], 
            where=where_clause,
            n_results=10
        )
        
        # 2. ランキング
        all_candidates = {}
        if vector_results['documents'] and vector_results['documents'][0]:
            for i, (doc, meta, doc_id) in enumerate(zip(vector_results['documents'][0], vector_results['metadatas'][0], vector_results['ids'][0])):
                score = (10 - i) + (meta.get('importance', 50) / 10)
                all_candidates[doc_id] = [doc, meta, score]

        sorted_candidates = sorted(all_candidates.values(), key=lambda x: x[2], reverse=True)[:8]
        
        # 3. コンテキスト構築 (XML形式)
        context_parts = []
        for i, (doc, meta, score) in enumerate(sorted_candidates):
            memory_xml = f"""    <memory index="{i+1}" type="{meta.get('doc_type', 'OTHER')}" importance="{meta.get('importance', 50)}" project="{meta.get('project', 'Unknown')}">
      <source>{meta.get('file', '不明')}</source>
      <path>{meta.get('path', '')}</path>
      <content>
{doc}
      </content>
    </memory>"""
            context_parts.append(memory_xml)
        
        wrapped_context = f"<creation_memory>\n" + "\n".join(context_parts) + "\n</creation_memory>"
        
        # 4. プロンプト構築
        base_system_prompt = """あなたは小説執筆の「物語整合性アドバイザー」です。提供された <creation_memory> を元に答えてください。"""
        final_system_prompt = f"{request.system_prompt}\n\n{base_system_prompt}" if request.system_prompt else base_system_prompt
        prompt = f"以下の <creation_memory> を解析し支援してください。\n\n{wrapped_context}\n\n【質問】\n{query}"

        async def generate():
            try:
                async for chunk in await async_client.chat(
                    model=model_name,
                    messages=[{'role': 'system', 'content': final_system_prompt}, {'role': 'user', 'content': prompt}],
                    stream=True
                ):
                    yield json.dumps({"message": {"content": chunk['message']['content']}, "done": chunk.get('done', False)}) + "\n"
            except Exception as e:
                yield json.dumps({"error": str(e)}) + "\n"

        return StreamingResponse(generate(), media_type="application/x-ndjson")

    except Exception as e:
        print(f"❌ Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/db/propose_metadata")
async def propose_metadata(request: Request):
    """
    ファイルパスからプロジェクト名やドキュメントタイプを高速に提案する
    (AIを使わず、KnowledgeProcessorのルールベースを使用する)
    """
    try:
        data = await request.json()
        file_path = data.get("file_path", "")
        content = data.get("content", "")
        
        from knowledge_processor import KnowledgeProcessor
        kp = KnowledgeProcessor()
        metadata = kp.process_file(file_path, content)
        
        return {
            "project": metadata.get("project", "Unknown"),
            "doc_type": metadata.get("doc_type", "OTHER"),
            "importance": metadata.get("importance", 50),
            "entities": metadata.get("entities", "").split(",")
        }
    except Exception as e:
        print(f"❌ Propose Error: {e}")
        return {"project": "Unknown", "doc_type": "OTHER", "importance": 50, "entities": []}

@app.post("/db/suggest_tags")
async def suggest_tags(request: Request):
    data = await request.json()
    content = data.get("content", "")
    from knowledge_processor import KnowledgeProcessor
    kp = KnowledgeProcessor()
    entities = kp._extract_entities("temp.txt", content)
    return {"tags": list(entities)[:15]}

@app.delete("/db/items")
async def delete_db_item(request: Request):
    data = await request.json()
    full_path = data.get("full_path")
    if not full_path: return {"success": False}
    collection.delete(where={"full_path": full_path})
    return {"success": True}

@app.post("/db/ingest")
async def trigger_ingest():
    from ingest_novels import ingest_novels
    # 非同期実行が望ましいが、リクエストを受け取って開始
    threading.Thread(target=ingest_novels).start()
    return {"status": "started"}

@app.get("/db/items")
async def list_db_items():
    try:
        results = collection.get(include=['metadatas', 'documents'])
        files_map = {}
        for i, meta in enumerate(results['metadatas']):
            full_path = meta.get('full_path')
            if not full_path: continue
            if full_path not in files_map:
                files_map[full_path] = {
                    "file": meta.get('file'),
                    "path": meta.get('path'),
                    "full_path": full_path,
                    "preview": results['documents'][i][:150] + "...",
                    "tags": meta.get('tags', '').split(','),
                    "importance": meta.get('importance', 50),
                    "project": meta.get('project', 'Unknown'),
                    "doc_type": meta.get('doc_type', 'OTHER')
                }
        return sorted(list(files_map.values()), key=lambda x: x['file'])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/analyze/proofread")
async def combined_proofread(request: AskRequest):
    text = request.query
    file_path = request.file_path
    
    from proofreader import Proofreader
    from knowledge_processor import KnowledgeProcessor
    from story_state_extractor import StoryStateExtractor
    
    pr = Proofreader()
    kp = KnowledgeProcessor()
    sse = StoryStateExtractor()
    
    project_id = kp._determine_project(file_path) if file_path else "Unknown"
    
    # 1. ルールベース校正
    states = sse.extract_all_states(project_id=project_id)
    static_corrections = pr.proofread(text, materials_context=states)
    static_xml = pr.to_xml(static_corrections)
    
    # 2. AI校正
    async_client = ollama.AsyncClient()
    response_vector = await async_client.embeddings(model="nomic-embed-text", prompt=text[:500])
    where_clause = {"project": project_id} if project_id != "Unknown" else None
    results = collection.query(query_embeddings=[response_vector["embedding"]], where=where_clause, n_results=5)
    
    context = "\n".join([f'<memory type="{m.get("doc_type")}" source="{m.get("file")}">{d}</memory>' for d, m in zip(results['documents'][0], results['metadatas'][0])]) if results['documents'] else ""
    
    system_prompt = """あなたは小説の物語監査官です。設定矛盾だけに集中し、<correction>タグ形式で出力してください。"""
    prompt = f"<creation_memory>\n{context}\n</creation_memory>\n\n【対象テキスト】\n{text}"

    try:
        response = await async_client.chat(model=request.model, messages=[{'role': 'system', 'content': system_prompt}, {'role': 'user', 'content': prompt}])
        ai_xml = response['message']['content']
    except:
        ai_xml = ""

    return {"corrections": static_xml + ai_xml}

@app.post("/analyze/audit/start")
async def start_full_audit(background_tasks: BackgroundTasks):
    global audit_state
    if audit_state["running"]: return {"status": "already_running"}
    
    def run_audit_process():
        global audit_state
        audit_state["running"] = True
        audit_state["completed"] = False
        audit_state["progress"] = "監査実行中..."
        try:
            from audit_batch_processor import AuditBatchProcessor
            processor = AuditBatchProcessor()
            processor.run_full_audit()
            audit_state["completed"] = True
            audit_state["progress"] = "完了"
        except Exception as e:
            audit_state["progress"] = f"エラー: {e}"
        finally:
            audit_state["running"] = False

    background_tasks.add_task(run_audit_process)
    return {"status": "started"}

@app.get("/analyze/audit/status")
async def get_audit_status():
    return audit_state

@app.get("/analyze/audit/report")
async def get_audit_report():
    report_path = os.path.join(os.path.dirname(__file__), "homework_list.json")
    if os.path.exists(report_path):
        with open(report_path, "r", encoding="utf-8") as f: return json.load(f)
    return []

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
