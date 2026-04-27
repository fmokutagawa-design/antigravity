const { RuleHelper } = require("textlint-rule-helper");
const { getTokenizer } = require("kuromojin");
const fs = require("fs");
const path = require("path");

// Load the pre-extracted complex rules
const complexRulesPath = path.join(__dirname, "lt_complex_rules.json");
let complexRules = [];
try {
    complexRules = JSON.parse(fs.readFileSync(complexRulesPath, "utf-8"));
} catch (e) {
    console.error("Failed to load complex rules:", e);
}

module.exports = function(context) {
    const { Syntax, RuleError, report, getSource } = context;
    const ruleHelper = new RuleHelper(context);

    return {
        async [Syntax.Str](node) {
            if (ruleHelper.isChildNode(node, [Syntax.Link, Syntax.Image, Syntax.BlockQuote])) {
                return;
            }

            const text = getSource(node);
            const tokenizer = await getTokenizer();
            const tokens = await tokenizer.tokenize(text);

            // Helper to match a single token against a rule token definition
            const matchToken = (textToken, ruleToken) => {
                if (!textToken) return false;

                // Surface match
                if (ruleToken.surface) {
                    if (ruleToken.regexp) {
                        const regex = new RegExp(`^${ruleToken.surface}$`);
                        if (!regex.test(textToken.surface_form)) return false;
                    } else if (ruleToken.surface !== textToken.surface_form) {
                        // Handle inflected check if surface doesn't match
                        if (!ruleToken.inflected || ruleToken.surface !== textToken.basic_form) {
                            return false;
                        }
                    }
                }

                // POS match
                if (ruleToken.postag) {
                    const postag = textToken.pos + (textToken.pos_detail_1 ? "-" + textToken.pos_detail_1 : "");
                    if (ruleToken.postag_regexp) {
                        const regex = new RegExp(`^${ruleToken.postag}`);
                        if (!regex.test(postag)) return false;
                    } else if (ruleToken.postag !== postag) {
                        return false;
                    }
                }

                return true;
            };

            // Run the LT Interpreter
            for (let i = 0; i < tokens.length; i++) {
                // Optimization: In a real high-perf engine, we'd use a prefix-map.
                // For now, we iterate, but LT rules are mostly specific enough.
                
                for (const rule of complexRules) {
                    let tokenIdx = i;
                    let matched = true;
                    
                    for (let tStep = 0; tStep < rule.tokens.length; tStep++) {
                        const rToken = rule.tokens[tStep];
                        const textToken = tokens[tokenIdx];
                        
                        if (!matchToken(textToken, rToken)) {
                            // If it doesn't match, check if we can skip (LT skip attribute)
                            let skipFound = false;
                            if (rToken.skip > 0) {
                                for (let s = 1; s <= rToken.skip && (tokenIdx + s) < tokens.length; s++) {
                                    if (matchToken(tokens[tokenIdx + s], rToken)) {
                                        tokenIdx += s;
                                        skipFound = true;
                                        break;
                                    }
                                }
                            }
                            
                            if (!skipFound) {
                                matched = false;
                                break;
                            }
                        }
                        tokenIdx++;
                    }

                    if (matched) {
                        report(node, new RuleError(`【NEXUS統合校正】${rule.message} (Rule: ${rule.id})`, {
                            index: tokens[i].word_position - 1
                        }));
                    }
                }
            }

            // --- Tomarigi Subsidiary/Formal Noun checks (POS based) ---
            tokens.forEach((token) => {
                const subsidiaryVerbs = ["見", "居", "置", "来", "行", "言", "出"];
                if (subsidiaryVerbs.includes(token.surface_form) && token.pos === "動詞" && token.pos_detail_1 === "非自立") {
                    report(node, new RuleError(`【トマリギ】補助動詞「${token.surface_form}」はひらがな表記が推奨されます。`, { index: token.word_position - 1 }));
                }
                const formalNouns = ["時", "事", "所", "物", "方", "上", "内", "中", "為"];
                if (formalNouns.includes(token.surface_form) && token.pos === "名詞" && token.pos_detail_1 === "非自立") {
                    report(node, new RuleError(`【トマリギ】形式名詞「${token.surface_form}」はひらがな表記が推奨されます。`, { index: token.word_position - 1 }));
                }
            });
        }
    };
};
