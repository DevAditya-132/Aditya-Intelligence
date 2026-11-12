"""Validate instruction JSONL and make deterministic train/validation splits."""
import argparse, json, random
from pathlib import Path

VALID_ROLES = {"system", "user", "assistant"}

def validate(record, origin):
    messages = record.get("messages")
    if not isinstance(messages, list) or len(messages) < 2:
        raise ValueError(f"{origin}: messages must contain at least two entries")
    for message in messages:
        if not isinstance(message, dict) or message.get("role") not in VALID_ROLES:
            raise ValueError(f"{origin}: invalid message role")
        if not isinstance(message.get("content"), str) or not message["content"].strip():
            raise ValueError(f"{origin}: content must be nonempty text")
    if messages[-1]["role"] != "assistant":
        raise ValueError(f"{origin}: final message must be an assistant response")
    return {"messages": messages}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="JSONL file or directory")
    parser.add_argument("--output", required=True)
    parser.add_argument("--validation-ratio", type=float, default=0.1)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()
    if not 0 < args.validation_ratio < 0.5: raise SystemExit("validation ratio must be between 0 and 0.5")
    source = Path(args.input)
    files = [source] if source.is_file() else sorted(source.glob("*.jsonl"))
    if not files: raise SystemExit("No .jsonl files found")
    rows = []
    for file in files:
        for line_number, line in enumerate(file.read_text(encoding="utf-8").splitlines(), 1):
            if line.strip(): rows.append(validate(json.loads(line), f"{file}:{line_number}"))
    if len(rows) < 10: raise SystemExit("Need at least 10 records for a useful split")
    random.Random(args.seed).shuffle(rows)
    cut = max(1, round(len(rows) * args.validation_ratio))
    out = Path(args.output); out.mkdir(parents=True, exist_ok=True)
    for name, split in (("validation", rows[:cut]), ("train", rows[cut:])):
        (out / f"{name}.jsonl").write_text("".join(json.dumps(x, ensure_ascii=False) + "\n" for x in split), encoding="utf-8")
    print(f"Wrote {len(rows)-cut} train and {cut} validation examples to {out}")

if __name__ == "__main__": main()
