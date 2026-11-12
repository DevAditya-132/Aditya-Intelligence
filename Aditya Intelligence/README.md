# Aditya Intelligence

Aditya Intelligence is a local Windows desktop chat application.  It runs a quantized
language model through `llama.cpp`; messages, generated text, and conversation
history stay on the computer.  It has no cloud API, account, analytics, or
telemetry.

## What this build uses

| Part | Choice |
| --- | --- |
| Model | Qwen2.5-1.5B-Instruct, Q4_K_M GGUF (about 1.1 GB) |
| Inference | `llama-server.exe` from llama.cpp, bound only to `127.0.0.1` |
| Desktop shell | Electron downloaded by setup; no global Node or Python needed to chat |
| Chat storage | `%APPDATA%\\Aditya Intelligence\\conversations.json` |

The included setup uses the official Qwen GGUF repository and current
`ggml-org/llama.cpp` Windows CPU release. Qwen2.5 is released under Apache-2.0;
see [the model card](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF)
and [llama.cpp's MIT license](https://github.com/ggml-org/llama.cpp/blob/master/LICENSE).

## Install and run

1. Run Setup.cmd to download model. It is roughly 1.1gb (completely offline AI once installed).
2. Run `run.cmd`.
3. Wait for the green **Offline · Ready** badge, then chat with Aditya Intelligence.

setup.cmd is safe to run again: it keeps completed downloads and only fetches
missing pieces. `run.cmd` starts the local engine automatically. No account or
internet connection is required after setup.

## Publishing this project

The `.runtime/` folder is intentionally excluded from Git because it contains
large downloaded programs and a model. Publish the source and setup scripts;
users can download the runtime by running `setup.cmd` on Windows. Before
publishing, review `LICENSES.md` and include a repository license that covers
your own source files. Third-party runtime and model licenses remain separate.

## Controls

- **New chat** starts a locally saved conversation.
- **Stop** immediately cancels the current local generation.
- **Regenerate** replaces the last assistant reply using the prior prompt.
- **Clear chat** empties the visible conversation after confirmation.
- `Enter` sends; `Shift+Enter` inserts a line break.

## Hardware assessment

This machine has an Intel Core i3-12100 and 7.7 GiB of RAM. The chosen Q4 model
is a sensible CPU-only fit with the configured 2048-token context. Close large
applications while using it; 8 GB is the practical minimum here. Expect a
short startup load and modest, CPU-bound token speed. For longer context or a
7B model, use 16 GB+ RAM. A GPU is optional and this build intentionally uses
the dependable CPU package.

## Training: what is realistic

Training a capable general-purpose language model from scratch is not feasible
on this PC. It requires enormous datasets and many GPU-years. This project
instead supplies a reproducible LoRA fine-tuning path for Qwen2.5 1.5B; that is
the practical way to specialize the chat model. It includes JSONL validation,
train/validation splitting, training, held-out loss evaluation, adapter merge,
and GGUF/Q4 export. See [training/README.md](training/README.md).

There is also a deliberately small, from-scratch educational character model in
`training/educational_tiny_lm.py`. It proves the mechanics of training but is
not used by the chat app and will not become a useful general assistant.

You can also use Setup.ps1 as an alternative to install model yet i don't recommend using it. 

## Privacy and networking

At runtime, the only service is `llama-server.exe` listening on
`127.0.0.1:18080`. Electron does not load remote pages; its CSP permits only
the packaged UI. The app sends model prompts only to that local address.
Conversation data can be removed by deleting the `%APPDATA%\\Aditya Intelligence`
folder after closing the app.
