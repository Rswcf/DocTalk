# DocTalk /demo probe, 'Attention Is All You Need' (seed attention-paper.pdf), 2026-10-10T20:05:07Z, anonymous, mode=quick
# Page check: pdftotext -f N -l N backend/seed_data/attention-paper.pdf. p8: 28.4 BLEU + '3.5 days on 8 P100 GPUs' (s6.1); p7: 300,000 steps, step time 1.0 s (s5.2); p4: 'dot products grow large in magnitude', variance d_k (s3.2.1). p1 (ref 5): abstract says 'a small fraction of the training costs' about the big model; the answer used it for the base-model claim, which is on p8. => 5 distinct citations, all carry a page; 4 of 5 pages state the cited fact; 1 related-not-exact.
{
 "session_keys": [
  "created_at",
  "demo_messages_used",
  "document_id",
  "session_id",
  "title"
 ],
 "results": [
  {
   "q": "What BLEU score does the big Transformer model reach on the WMT 2014 English-to-German task, and how long did it take to train?",
   "answer": "Based on the document, here are the details for the big Transformer model on the WMT 2014 English-to-German translation task:\n\n- **BLEU score:** The big Transformer model establishes a new state-of-the-art BLEU score of **28.4**, outperforming the best previously reported models (including ensembles) by more than 2.0 BLEU .\n- **Training time:** Training took **3.5 days on 8 P100 GPUs** . The big models were trained for 300,000 steps, with a step time of 1.0 seconds .\n\nFor context, the base model also surpasses all previously published models and ensembles, but at a fraction of the training cost of the competitive models .",
   "citations": [
    {
     "ref_index": 2,
     "page": 8,
     "page_end": 8,
     "text_snippet": "arXiv:1706.03762v7 [cs.CL] 2 Aug 2023: Deep-Att + PosUnk Ensemble [39]40.41.8 · 10201.1 · 1021GNMT +",
     "snippet": null,
     "quote": null
    },
    {
     "ref_index": 5,
     "page": 1,
     "page_end": 1,
     "text_snippet": "Provided proper attribution is provided, Google hereby grants permission toreproduce the tables and ",
     "snippet": null,
     "quote": null
    },
    {
     "ref_index": 2,
     "page": 8,
     "page_end": 8,
     "text_snippet": "arXiv:1706.03762v7 [cs.CL] 2 Aug 2023: Deep-Att + PosUnk Ensemble [39]40.41.8 · 10201.1 · 1021GNMT +",
     "snippet": null,
     "quote": null
    },
    {
     "ref_index": 3,
     "page": 7,
     "page_end": 8,
     "text_snippet": "arXiv:1706.03762v7 [cs.CL] 2 Aug 2023: trained the base models for a total of 100,000 steps or 12 ho",
     "snippet": null,
     "quote": null
    },
    {
     "ref_index": 2,
     "page": 8,
     "page_end": 8,
     "text_snippet": "arXiv:1706.03762v7 [cs.CL] 2 Aug 2023: Deep-Att + PosUnk Ensemble [39]40.41.8 · 10201.1 · 1021GNMT +",
     "snippet": null,
     "quote": null
    }
   ]
  },
  {
   "q": "Why do the authors scale the dot products by 1 over the square root of d_k?",
   "answer": "The authors scale the dot products by 1/√d_k to counteract a numerical problem that arises with large values of d_k:\n\n- **The problem:** For large values of d_k, the dot products grow large in magnitude, which pushes the softmax function into regions where it has extremely small gradients .\n- **Why the dot products get large:** If the components of q and k are independent random variables with mean 0 and variance 1, then their dot product q · k = Σ q_i k_i has mean 0 and variance d_k . So larger d_k means larger-magnitude dot products.\n- **The fix:** To counteract this effect, the authors scale the dot products by 1/√d_k .\n- **Comparison with additive attention:** While additive attention and dot-product attention perform similarly for small values of d_k, additive attention outperforms unscaled dot-product attention for larger values of d_k . The scaling factor is the only difference between the authors' algorithm and standard dot-product attention .",
   "citations": [
    {
     "ref_index": 1,
     "page": 4,
     "page_end": 5,
     "text_snippet": "arXiv:1706.03762v7 [cs.CL] 2 Aug 2023: dk, the dot products grow large in magnitude, pushing the sof",
     "snippet": null,
     "quote": null
    },
    {
     "ref_index": 1,
     "page": 4,
     "page_end": 5,
     "text_snippet": "arXiv:1706.03762v7 [cs.CL] 2 Aug 2023: dk, the dot products grow large in magnitude, pushing the sof",
     "snippet": null,
     "quote": null
    },
    {
     "ref_index": 1,
     "page": 4,
     "page_end": 5,
     "text_snippet": "arXiv:1706.03762v7 [cs.CL] 2 Aug 2023: dk, the dot products grow large in magnitude, pushing the sof",
     "snippet": null,
     "quote": null
    },
    {
     "ref_index": 2,
     "page": 4,
     "page_end": 4,
     "text_snippet": "arXiv:1706.03762v7 [cs.CL] 2 Aug 2023: of the values, where the weight assigned to each value is com",
     "snippet": null,
     "quote": null
    },
    {
     "ref_index": 2,
     "page": 4,
     "page_end": 4,
     "text_snippet": "arXiv:1706.03762v7 [cs.CL] 2 Aug 2023: of the values, where the weight assigned to each value is com",
     "snippet": null,
     "quote": null
    }
   ]
  }
 ]
}
