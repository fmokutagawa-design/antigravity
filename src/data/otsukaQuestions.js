// Hero's Journey (12 Stages) Template
// Hero's Journey (12 Stages) Template
export const HERO_JOURNEY_TEMPLATE = {
    scenes: [
        { id: 'stage-1', act: '第1幕: 出立', title: '日常の世界', description: '主人公の日常、不足しているもの、問題点' },
        { id: 'stage-2', act: '第1幕: 出立', title: '冒険への誘い', description: '事件の始まり、使者からの依頼' },
        { id: 'stage-3', act: '第1幕: 出立', title: '冒険の拒絶', description: '変化への恐れ、ためらい' },
        { id: 'stage-4', act: '第1幕: 出立', title: '賢者との出会い', description: '師匠、アイテム、知識の獲得' },
        { id: 'stage-5', act: '第1幕: 出立', title: '第一関門突破', description: '日常から非日常への境界越え' },
        { id: 'stage-6', act: '第2幕: 試練', title: '試練・仲間・敵', description: '新しい世界のルール、敵対者、協力者' },
        { id: 'stage-7', act: '第2幕: 試練', title: '最も危険な場所への接近', description: '目的への接近、深淵への入り口' },
        { id: 'stage-8', act: '第2幕: 試練', title: '最大の試練', description: '死と再生、最大のピンチ' },
        { id: 'stage-9', act: '第2幕: 試練', title: '報酬', description: '目的の達成、剣の獲得' },
        { id: 'stage-10', act: '第3幕: 帰還', title: '帰路', description: '追跡、脱出、まだ終わっていない戦い' },
        { id: 'stage-11', act: '第3幕: 帰還', title: '復活', description: '最後の試練、変化の証明、決着' },
        { id: 'stage-12', act: '第3幕: 帰還', title: '宝を持っての帰還', description: '新しい日常、変化した世界、教訓' },
    ],
    cards: {
        'stage-1': [], 'stage-2': [], 'stage-3': [], 'stage-4': [],
        'stage-5': [], 'stage-6': [], 'stage-7': [], 'stage-8': [],
        'stage-9': [], 'stage-10': [], 'stage-11': [], 'stage-12': []
    }
};

// Hollywood / Three-Act Structure (8 Sequences) Template
export const HOLLYWOOD_TEMPLATE = {
    scenes: [
        { id: 'seq-1', act: '第1幕: 設定 (Setup)', title: '日常・状況設定', description: '物語の始まり、主人公の日常、現状の説明' },
        { id: 'seq-2', act: '第1幕: 設定 (Setup)', title: 'きっかけ・決意', description: 'インサイティング・インシデント（事件）、冒険への旅立ち' },
        { id: 'seq-3', act: '第2幕: 対立 (Confrontation)', title: '第一プロットポイント', description: '後戻りできない地点（境界越え）、試練の始まり' },
        { id: 'seq-4', act: '第2幕: 対立 (Confrontation)', title: 'ピンチポイント1', description: '敵の脅威、葛藤の深化、最初の大きな障壁' },
        { id: 'seq-5', act: '第2幕: 対立 (Confrontation)', title: 'ミッドポイント', description: '物語の中間点、重要な転換、真実の発見' },
        { id: 'seq-6', act: '第2幕: 対立 (Confrontation)', title: 'ピンチポイント2', description: '最大の危機（オール・ホープ・イズ・ロスト）、絶望' },
        { id: 'seq-7', act: '第3幕: 解決 (Resolution)', title: '第二プロットポイント', description: '解決への糸口、最後の戦いへの決意' },
        { id: 'seq-8', act: '第3幕: 解決 (Resolution)', title: 'クライマックス・結末', description: '最終決戦、変化の結果、新しい日常' },
    ],
    cards: {
        'seq-1': [], 'seq-2': [], 'seq-3': [], 'seq-4': [],
        'seq-5': [], 'seq-6': [], 'seq-7': [], 'seq-8': []
    }
};

// Simple Wizard Questions (11 Items)
export const SIMPLE_QUESTIONS = [
    { id: 's1', text: "物語のアイデアを一文で書いてください（ログライン）。", target: 'stage-1', type: 'note', label: 'ログライン' },
    { id: 's2', text: "主人公は誰で、何を求めていますか？（目的と欠落）", target: 'stage-1', type: 'character', label: '主人公と目的' },
    { id: 's3', text: "主人公の邪魔をする敵対者は誰ですか？", target: 'stage-6', type: 'character', label: '敵対者' },
    { id: 's4', text: "主人公が住む「日常の世界」はどんな場所ですか？", target: 'stage-1', type: 'note', label: '日常世界' },
    { id: 's5', text: "物語が動き出すきっかけ（事件）は何ですか？", target: 'stage-2', type: 'event', label: 'きっかけ' },
    { id: 's6', text: "主人公が冒険の旅に出る（後戻りできなくなる）瞬間は？", target: 'stage-5', type: 'event', label: '旅立ち' },
    { id: 's7', text: "物語の中盤で起きる大きな転換点（ミッドポイント/真実の発見）は？", target: 'stage-8', type: 'event', label: '中間点' },
    { id: 's8', text: "主人公が最も追い詰められる最大の危機は？", target: 'stage-8', type: 'event', label: '最大の危機' },
    { id: 's9', text: "物語のクライマックス、敵との決着はどうなりますか？", target: 'stage-11', type: 'event', label: 'クライマックス' },
    { id: 's10', text: "最後に主人公はどう変化し、どんな「新しい日常」を迎えますか？", target: 'stage-12', type: 'note', label: '結末と変化' },
    { id: 's11', text: "物語の重要な伏線（アイテムや秘密）を一つ挙げてください。", target: 'stage-4', type: 'foreshadow', label: '重要伏線' }
];

// Simple Timeline Template (10 Chapters)
export const SIMPLE_TEMPLATE = {
    scenes: Array.from({ length: 10 }, (_, i) => ({
        id: `chap-${i + 1}`,
        act: `第${i + 1}章`,
        title: `第${i + 1}章`,
        description: '自由な構成'
    })),
    cards: Array.from({ length: 10 }, (_, i) => [`chap-${i + 1}`, []]).reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {})
};

// Otsuka Questions List (30 Items)
export const OTSUKA_QUESTIONS = [
    // --- Premise (Q1-Q2) ---
    { id: 1, text: "まずあなたがこれから書こうとする物語のうち、頭の中に現状あるものをどのような形でもいいのでとりあえず書いて下さい。", target: 'stage-1', type: 'note', label: '初期イメージ' },
    { id: 2, text: "Q1のプロットを一文で言い表すとどうなりますか（ログライン）。", target: 'stage-1', type: 'note', label: 'ログライン' },

    // --- Protagonist (Q3-Q10) ---
    { id: 3, text: "あなたがこれから書こうとする物語の主人公について思いつくまま記して下さい。", target: 'stage-1', type: 'character', label: '主人公' },
    { id: 4, text: "あなたの主人公が現在抱えている問題を「主人公は×××が欠けている状態にある」という形で表現して下さい。欠けているものを具体的に書き、次にそれが何の『象徴』であるかを一言で記して下さい。", target: 'stage-1', type: 'note', label: '欠落と象徴' },
    { id: 5, text: "あなたの主人公の「現在」について設計して、一番イメージに合うものを以下(A-D)より選択してください (A:運命自覚なし, B:成功, C:没落, D:失敗)。", target: 'stage-1', type: 'note', label: '現在の状態' },
    { id: 6, text: "ログラインを「主人公は×××の状態で△△△を求めているが最後に□□□になる」といった程度のシンプルな文章を作ってみて下さい。これは主人公の内的な変化の定義です。", target: 'stage-12', type: 'note', label: '変化の定義' },
    { id: 7, text: "あなたの主人公の現在に影響を与えた「過去」について記入して下さい。", target: 'stage-1', type: 'character', label: '過去' },
    { id: 8, text: "Q4の「欠けているもの」を手に入れるために誰かから与えられる（あるいは自らこなさなくてはいけない）具体的な課題やミッション、クエストは何かを考えて下さい。", target: 'stage-2', type: 'event', label: '課題' },
    { id: 9, text: "その外的な目的や課題を主人公が最終的に達成するか否かを決めましょう。", target: 'stage-11', type: 'event', label: '達成の成否' },
    { id: 10, text: "その結果象徴的に手に入れるもの、ないしは失うものは何でしょう。", target: 'stage-9', type: 'item', label: '獲得/喪失' },

    // --- Antagonist & Helper (Q11-Q19) ---
    { id: 11, text: "主人公の目的達成を妨害する中心的キャラクター、「敵対者」は誰ですか。", target: 'stage-6', type: 'character', label: '敵対者' },
    { id: 12, text: "主人公と敵対者の価値観や考え方はどう違いますか。", target: 'stage-6', type: 'note', label: '敵との対比' },
    { id: 13, text: "主人公の傍らにいて目的達成を助けるキャラクターは誰ですか。", target: 'stage-6', type: 'character', label: '協力者' },
    { id: 14, text: "主人公を助ける中心的キャラクターが主人公を助けるのは何故ですか。", target: 'stage-6', type: 'note', label: '協力の理由' },
    { id: 15, text: "主人公を庇護したり主人公が成功するポイントとなる力、アイテム、アイデア、知恵などを与えてくれるキャラクターは誰ですか。", target: 'stage-4', type: 'character', label: '賢者' },
    { id: 16, text: "主人公がQ15のキャラクターから援助を受けるのは何故でしょう。", target: 'stage-4', type: 'event', label: '援助の理由' },
    { id: 17, text: "主人公の生きている「日常世界」はどういう場所・環境ですか。", target: 'stage-1', type: 'note', label: '日常世界' },
    { id: 18, text: "その日常に危機が迫っていることを予感させるできごとは何ですか。", target: 'stage-1', type: 'foreshadow', label: '危機の予兆' },
    { id: 19, text: "その日常はどのように具体的に脅かされますか。", target: 'stage-2', type: 'event', label: '日常の脅威' },

    // --- Plot Steps (Q20-Q29) ---
    { id: 20, text: "主人公に行動を起こさせるきっかけとなる「使者」「依頼者」は誰ですか。", target: 'stage-2', type: 'character', label: '使者' },
    { id: 21, text: "主人公は行動を起こすことでためらったり、誰かにとめられます。そのくだりを必ずつくっておいて下さい。", target: 'stage-3', type: 'event', label: '変化への拒絶' },
    { id: 22, text: "主人公の行動に対して何かタブーを与えますか。", target: 'stage-3', type: 'foreshadow', label: 'タブー' },
    { id: 23, text: "主人公が物語の中で到達する「日常」と最も離れた場所はどこですか。", target: 'stage-7', type: 'note', label: '最も危険な場所' },
    { id: 24, text: "主人公はそこで直面した問題をどうやって解決し、その結果どう変わりますか。", target: 'stage-8', type: 'event', label: '問題解決と変化' },
    { id: 25, text: "主人公が目的を達成するために失ったものは何ですか。", target: 'stage-8', type: 'foreshadow', label: '代償' },
    { id: 26, text: "敵対者と直接対峙した時、主人公は敵対者を理解しますか。和解したり、赦すことは。赦せないとしたら何故、どこが。", target: 'stage-11', type: 'event', label: '敵との対峙' },
    { id: 27, text: "この物語の結末において主人公の生きる環境はどう変わりますか。", target: 'stage-12', type: 'note', label: '新しい日常' },

    // Q28 (Graph) omitted as it is the tool's function.
    { id: 29, text: "どんなタイプの主人公ですか？", target: 'stage-1', type: 'character', label: '主人公タイプ' },

    { id: 30, text: "もう1回、あなたのつくった物語を一言でまとめてみて下さい。", target: 'stage-12', type: 'note', label: '新ログライン' },
];
