const { ipcMain } = require('electron');
const path = require('path');
const { createLinter, loadTextlintrc } = require('textlint');
const { TextlintLintableRuleDescriptor } = require('@textlint/kernel');

let linter = null;

/**
 * textlintエンジンの初期化
 * 統合ルール（LanguageTool/RedPen移植）とTomarigi辞書を組み合わせる
 */
async function initLinter() {
    try {
        const descriptor = await loadTextlintrc({
            configFilePath: path.join(__dirname, '../.textlintrc.js')
        });

        // 自作ルール（移植ロジック）を手動で注入
        const customRule = require('../textlint/rules/nexus-integrated-rules.js');
        descriptor.rule.ruleDescriptorList.push(new TextlintLintableRuleDescriptor({
            ruleId: "nexus-integrated-rules",
            rule: customRule,
            options: true
        }));

        linter = createLinter({ descriptor });
        console.log('[textlint] Linguistic Hub initialized successfully.');
    } catch (error) {
        console.error('[textlint] Failed to initialize linter:', error);
    }
}

function setupTextlintHandlers() {
    // 起動時に初期化
    initLinter();

    ipcMain.handle('textlint:proofread', async (event, text) => {
        try {
            if (!linter) {
                await initLinter();
            }
            if (!linter) return [];

            console.log('[textlint] starting proofread...');
            // ファイル名は仮のものを指定
            const results = await linter.lintText(text, "document.txt");
            
            return results.messages.map(msg => ({
                message: msg.message,
                line: msg.line,
                column: msg.column,
                severity: msg.severity,
                ruleId: msg.ruleId,
                fix: msg.fix,
                index: msg.index
            }));
        } catch (error) {
            console.error('[textlint] Error during proofread:', error);
            throw error;
        }
    });
}

module.exports = { setupTextlintHandlers };
