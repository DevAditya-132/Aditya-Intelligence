"""Fine-tune Qwen with LoRA and report held-out loss."""
import argparse
from datasets import load_dataset
from peft import LoraConfig
from transformers import AutoModelForCausalLM, AutoTokenizer
from trl import SFTConfig, SFTTrainer

def format_example(example, tokenizer):
    return {"text": tokenizer.apply_chat_template(example["messages"], tokenize=False, add_generation_prompt=False)}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--base", default="Qwen/Qwen2.5-1.5B-Instruct")
    p.add_argument("--train", required=True); p.add_argument("--validation", required=True); p.add_argument("--output", required=True)
    p.add_argument("--epochs", type=float, default=3); p.add_argument("--batch-size", type=int, default=1); p.add_argument("--max-length", type=int, default=1024)
    a = p.parse_args()
    tokenizer = AutoTokenizer.from_pretrained(a.base, use_fast=True)
    tokenizer.pad_token = tokenizer.pad_token or tokenizer.eos_token
    data = load_dataset("json", data_files={"train": a.train, "validation": a.validation})
    data = data.map(lambda e: format_example(e, tokenizer), remove_columns=data["train"].column_names)
    model = AutoModelForCausalLM.from_pretrained(a.base, torch_dtype="auto")
    config = SFTConfig(output_dir=a.output, num_train_epochs=a.epochs, per_device_train_batch_size=a.batch_size,
        per_device_eval_batch_size=a.batch_size, gradient_accumulation_steps=8, learning_rate=2e-4,
        eval_strategy="epoch", save_strategy="epoch", logging_steps=5, max_length=a.max_length, report_to=[])
    lora = LoraConfig(r=16, lora_alpha=32, lora_dropout=0.05, target_modules=["q_proj", "k_proj", "v_proj", "o_proj"], task_type="CAUSAL_LM")
    trainer = SFTTrainer(model=model, args=config, train_dataset=data["train"], eval_dataset=data["validation"], processing_class=tokenizer, peft_config=lora)
    trainer.train(); metrics = trainer.evaluate(); trainer.save_model(a.output); tokenizer.save_pretrained(a.output)
    print(f"Held-out loss: {metrics.get('eval_loss')}")

if __name__ == "__main__": main()
