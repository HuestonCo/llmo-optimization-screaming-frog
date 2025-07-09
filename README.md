# 🧠 LLM Optimization Analyzer for Screaming Frog (with Gemini API)

A custom JavaScript-based analyzer for Screaming Frog that evaluates webpages for Large Language Model Optimization (LLMO) using the **Gemini 1.5 Flash API**. The script is using a Batched Pairwise approach.

Inspired by recent research:
- [Batched Self-Consistency Improves LLM Relevance Assessment and Ranking](https://arxiv.org/abs/2505.12570)
- [C‑SEO Bench: Does Conversational SEO Work?](https://arxiv.org/abs/2506.11097)

---

## 🚀 What It Does

This script performs a **passage-level, structured audit** of your pages using LLM analysis principles and Screaming Frog’s Custom JavaScript Engine.

It extracts content like:
- `<title>`, meta descriptions
- H1–H2 headers and surrounding text
- Primary paragraphs and list items
- JSON-LD structured data (schema.org)
- FAQ patterns and semantic blocks

Then, it generates a comprehensive prompt for Gemini to:
1. Identify target queries
2. Score the content per query (0–5)
3. Highlight strongest passages
4. Reveal content gaps
5. Suggest LLM optimization actions

---

## 🔧 How to Use in Screaming Frog

> ✅ JS Rendering must be enabled in Screaming Frog!

### Step-by-step:
1. Open **Screaming Frog**
2. Go to `Configuration → Custom → Custom JavaScript`
3. Paste the full `llmo-analyzer.js` script
4. Enable **JavaScript Rendering** under `Configuration → Spider → Rendering`
5. Run your crawl
6. View `Custom Extraction` output tab for Gemini-powered LLMO insights

---

## 📊 Output Example


OVERALL LLMO SCORE: 4.2/5
TOP 3 POTENTIAL: yes
RANKING POTENTIAL: high

TARGET QUERIES & SCORES:

1. "wireless gaming keyboard" - Score: 4.5/5 (strong)
2. "gaming keyboard mouse combo" - Score: 4.2/5 (strong)

CONTENT GAPS:

* No pricing details
* Missing comparison to competitors

RECOMMENDATIONS:

* Add structured FAQ section
* Include product comparison table


---

## 📐 How It Works (Brief)

- Simulates **Batched Pointwise (PW)** evaluation from research — passing up to 30 key passages in one structured Gemini prompt.
- Weighted scoring reflects traditional SEO prioritization (e.g., `<title>` > `<h1>` > `<p>`).
- Results reflect Gemini’s understanding of how LLMs rank pages semantically.

---

## ⚠️ Limitations

- Gemini API does not support native multi-document scoring (simulated via prompt structure)
- No true self-consistency (one-shot only)
- Limited to 4096 tokens per page
- Domain-specific variance (best for structured pages like ecommerce/docs)
- Model-specific scores (Gemini 1.5 Flash)

---

## 📘 Research Backing

This script is modeled after "mentioned" benchmarks:
- **+7.5% NDCG@10 gain** from batched vs. pointwise LLM scoring (GPT-4o) // Legal batch
- 2.77x boost in visibility when placed 1st in LLM context window (C‑SEO Bench) // Retail domains!

---

## 📄 License
MIT — use freely with attribution if publishing derivative work.

---

## 🙋‍♀️ Need Help?
Open an issue or contact me to implement this across large sites or integrate it with live LLM APIs.
```

---
