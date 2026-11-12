# Training Aditya Intelligence

This directory has two deliberately different paths.

## 1. Practical: specialize the local assistant with LoRA

This is the recommended path. It fine-tunes Qwen2.5-1.5B using your own
instruction data, keeping the base model's general ability. A CUDA GPU with at
least 8 GB VRAM is recommended. CPU training is technically possible but will
be extremely slow. Do this on a separate machine if necessary; the resulting
GGUF can be copied to `.runtime/models/` on the chat PC.

### Data

Put UTF-8 JSONL files in `training/data/`. Each row must contain a `messages`
array with `role` (`system`, `user`, or `assistant`) and nonempty `content`:

```json
{"messages":[{"role":"system","content":"You are Aditya Intelligence."},{"role":"user","content":"What is photosynthesis?"},{"role":"assistant","content":"Photosynthesis is..."}]}
```

Never train on sensitive conversations unless you understand that they can be
memorized by the resulting model.

### Run

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements-train.txt
python prepare_dataset.py --input data --output processed
python train_lora.py --train processed/train.jsonl --validation processed/validation.jsonl --output runs/aditya-lora
python merge_adapter.py --base Qwen/Qwen2.5-1.5B-Instruct --adapter runs/aditya-lora --output runs/aditya-merged
.\export_gguf.ps1 -MergedModel runs/aditya-merged -LlamaSource C:\src\llama.cpp
```

`train_lora.py` reports held-out loss at the end. Keep a separate hand-written
prompt set for qualitative checks such as helpfulness, factual restraint, and
the behavior you are teaching. Lower validation loss is useful but does not
prove response quality or safety.

`export_gguf.ps1` creates `runs/aditya-q4_k_m.gguf`. Copy it to
`.runtime/models/qwen2.5-1.5b-instruct-q4_k_m.gguf` (back up the original
first), then restart the app. You must honor the base model's Apache-2.0
license and retain any required notices.

## 2. Educational: train a tiny model from scratch

`from_scratch_markov.js` is a dependency-free character n-gram language model
that trains immediately on this PC and writes an inspectable JSON checkpoint:

```powershell
node from_scratch_markov.js --text sample_corpus.txt --output runs/aditya-tiny-markov.json
```

`educational_tiny_lm.py` initializes every parameter randomly and trains a
character-level Transformer on a tiny local text file. It needs only Python
and PyTorch, runs on CPU, emits a checkpoint and validation loss, and can make
short toy continuations. It does not make a capable chat assistant and cannot
be exported to GGUF for this app; it exists to give Aditya Intelligence a real,
auditable from-scratch training experiment without pretending it is a general
LLM.

```powershell
pip install torch
python educational_tiny_lm.py --text sample_corpus.txt --output runs/tiny --epochs 12
```

For a tiny experiment, the supplied sample corpus is enough. For meaningful
results, use text you have rights to, increase corpus quality/size substantially,
and expect the model only to learn local writing patterns.
