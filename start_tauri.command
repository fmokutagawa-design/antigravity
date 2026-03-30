#!/bin/zsh
cd "$(dirname "$0")"
echo "NEXUS (Tauri版) を起動しています..."
echo "初回起動時はRustのコンパイルが走るため、数分かかる場合があります。"
npm run tauri dev
