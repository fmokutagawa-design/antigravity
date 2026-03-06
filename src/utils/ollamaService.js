export const ollamaService = {
    // Default Ollama URL
    baseUrl: 'http://localhost:11434/api',

    // Check if Ollama is running
    async checkConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/tags`);
            return response.ok;
        } catch (error) {
            console.warn("Ollama connection failed:", error);
            return false;
        }
    },

    // Get available models
    async getModels() {
        try {
            const response = await fetch(`${this.baseUrl}/tags`);
            if (!response.ok) throw new Error('Failed to fetch models');
            const data = await response.json();
            return (data.models || []).map(m => m.name || m.model);
        } catch (error) {
            console.error("Error fetching models:", error);
            return [];
        }
    },

    // Generate text (Streaming support is better for UX, but starting simple)
    async generateText(prompt, model = 'llama3', onChunk = null) {
        try {
            const response = await fetch(`${this.baseUrl}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    prompt: prompt,
                    stream: !!onChunk
                })
            });

            if (!response.ok) throw new Error(`Ollama API Error: ${response.statusText}`);

            if (onChunk) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let fullText = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop(); // Keep the last partial line in buffer

                    for (const line of lines) {
                        if (line.trim() === '') continue;
                        try {
                            const json = JSON.parse(line);
                            if (json.response) {
                                fullText += json.response;
                                onChunk(json.response);
                            }
                            if (json.done) break;
                        } catch (e) {
                            console.warn("Error parsing chunk:", e);
                        }
                    }
                }
                return fullText;
            } else {
                // Non-streaming
                const data = await response.json();
                return data.response;
            }
        } catch (error) {
            console.error("Text generation failed:", error);
            throw error;
        }
    },

    // Chat completion (better for conversation)
    async chat(messages, model = 'llama3', onChunk = null, signal = null) {
        try {
            const response = await fetch(`${this.baseUrl}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: model,
                    messages: messages,
                    stream: !!onChunk
                }),
                signal: signal
            });

            if (!response.ok) throw new Error(`Ollama API Error: ${response.statusText}`);

            if (onChunk) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let fullText = '';

                while (true) {
                    if (signal && signal.aborted) {
                        reader.cancel();
                        break;
                    }
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    for (const line of lines) {
                        if (line.trim() === '') continue;
                        try {
                            const json = JSON.parse(line);
                            if (json.message && json.message.content) {
                                fullText += json.message.content;
                                onChunk(json.message.content);
                            }
                            if (json.done) break;
                        } catch (e) {
                            console.warn("Error parsing chunk:", e);
                        }
                    }
                }
                return fullText;
            } else {
                const data = await response.json();
                return data.message.content;
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('AI generation aborted by user');
                return null;
            }
            console.error("Chat completion failed:", error);
            throw error;
        }
    },

    // Completion with abort signal (Short generation for Ghost Text)
    async generateCompletion(prompt, model = 'llama3', signal = null, system = '') {
        try {
            const body = {
                model: model,
                prompt: prompt,
                stream: false,
                options: {
                    num_predict: 64, // Limit to short continuation
                    stop: ["\n\n"]   // Stop at paragraph break
                }
            };

            if (system) {
                body.system = system;
            }

            const response = await fetch(`${this.baseUrl}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: signal
            });

            if (!response.ok) throw new Error(`Ollama API Error: ${response.statusText}`);
            const data = await response.json();
            return data.response;
        } catch (error) {
            if (error.name === 'AbortError') {
                return null; // Silent return on abort
            }
            console.error("Completion failed:", error);
            throw error;
        }
    }
};
