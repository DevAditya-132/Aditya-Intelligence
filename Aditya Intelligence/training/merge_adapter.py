import argparse
from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

p = argparse.ArgumentParser(); p.add_argument('--base', required=True); p.add_argument('--adapter', required=True); p.add_argument('--output', required=True); a = p.parse_args()
model = AutoModelForCausalLM.from_pretrained(a.base, torch_dtype='auto')
PeftModel.from_pretrained(model, a.adapter).merge_and_unload().save_pretrained(a.output, safe_serialization=True)
AutoTokenizer.from_pretrained(a.base).save_pretrained(a.output)
print(f'Merged model saved to {a.output}')
