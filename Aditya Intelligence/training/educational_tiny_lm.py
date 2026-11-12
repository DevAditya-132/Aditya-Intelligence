"""A CPU-friendly, character-level Transformer trained entirely from scratch."""
import argparse, math, random
from pathlib import Path
import torch
from torch import nn

class TinyLM(nn.Module):
    def __init__(self, vocab, width=128, heads=4, layers=3, block=96):
        super().__init__(); self.block = block
        self.token = nn.Embedding(vocab, width); self.pos = nn.Embedding(block, width)
        layer = nn.TransformerEncoderLayer(width, heads, width * 4, batch_first=True, dropout=0.1)
        self.net = nn.TransformerEncoder(layer, layers); self.out = nn.Linear(width, vocab)
    def forward(self, x):
        pos = torch.arange(x.shape[1], device=x.device); mask = torch.triu(torch.ones(x.shape[1], x.shape[1], device=x.device), 1).bool()
        return self.out(self.net(self.token(x) + self.pos(pos), mask=mask))

def main():
    p = argparse.ArgumentParser(); p.add_argument('--text', required=True); p.add_argument('--output', required=True); p.add_argument('--epochs', type=int, default=12); p.add_argument('--seed', type=int, default=42); a = p.parse_args()
    torch.manual_seed(a.seed); random.seed(a.seed); raw = Path(a.text).read_text(encoding='utf8')
    chars = sorted(set(raw)); encode = {c:i for i,c in enumerate(chars)}; data = torch.tensor([encode[c] for c in raw], dtype=torch.long)
    if len(data) < 200: raise SystemExit('Use at least 200 characters of training text.')
    split = int(len(data)*.9); train, valid = data[:split], data[split:]; model = TinyLM(len(chars)); opt = torch.optim.AdamW(model.parameters(), lr=3e-4); lossfn = nn.CrossEntropyLoss(); block = model.block
    def batch(source):
        starts = torch.randint(len(source)-block-1, (16,)); x = torch.stack([source[i:i+block] for i in starts]); return x, torch.stack([source[i+1:i+block+1] for i in starts])
    model.train()
    for epoch in range(a.epochs):
        for _ in range(80):
            x,y=batch(train); opt.zero_grad(); loss=lossfn(model(x).reshape(-1,len(chars)), y.reshape(-1)); loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(), 1); opt.step()
        model.eval(); x,y=batch(valid); val=lossfn(model(x).reshape(-1,len(chars)),y.reshape(-1)).item(); model.train(); print(f'epoch {epoch+1}: validation loss {val:.3f}, perplexity {math.exp(min(val,10)):.1f}')
    out=Path(a.output); out.mkdir(parents=True, exist_ok=True); torch.save({'state_dict':model.state_dict(),'chars':chars,'block':block}, out/'tiny_lm.pt'); print(f'Saved randomly initialized-and-trained model to {out}/tiny_lm.pt')

if __name__ == '__main__': main()
