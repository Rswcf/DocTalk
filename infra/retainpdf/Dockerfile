# Keep the upstream image immutable. This patch only includes recognized Paddle
# footnotes in translation; it does not translate headers or citation labels.
FROM wxyhgk/retainpdf-app@sha256:04b83993cf0d4fe9d27071bbb42c6521fd5699898065e9cb93c5a70ffe2af7ef
USER root
COPY enable_footnotes.py /tmp/doctalk-enable-footnotes.py
RUN python /tmp/doctalk-enable-footnotes.py && rm /tmp/doctalk-enable-footnotes.py
USER retainpdf:retainpdf
RUN python -c 'from retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.translation_policy import derive_paddle_translation_policy as p; assert p(raw_label="footnote", block_type="text", sub_type="footnote").translate; assert not p(raw_label="header", block_type="text", sub_type="header").translate'

COPY verify_contract.py /tmp/doctalk-verify-contract.py
RUN python /tmp/doctalk-verify-contract.py
