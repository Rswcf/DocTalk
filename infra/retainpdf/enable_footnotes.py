"""Apply our bounded footnote policy correction to the pinned RetainPDF image.

Paddle already recognizes footnotes; the upstream policy excludes them before
translation. Fail closed if the pinned implementation changes unexpectedly.
"""
from pathlib import Path
from importlib.util import find_spec

POLICY_PATH = Path('/app/services/pipeline/retainpdf_pipeline/ocr/document_schema/provider_adapters/paddle/translation_policy.py')
OLD = '"footnote": PaddleTranslationPolicy(False, "provider_non_body:footnote"),'
NEW = '"footnote": PaddleTranslationPolicy(True, "provider_footnote_whitelist:footnote"),'


def patch_policy(path: Path = POLICY_PATH) -> None:
    source = path.read_text()
    if source.count(OLD) != 1:
        raise RuntimeError('RetainPDF footnote policy changed; inspect upstream before updating the image')
    path.write_text(source.replace(OLD, NEW))


if __name__ == '__main__':
    # The console pipeline imports the installed wheel, not the /app source
    # tree. Patch both and fail if either no longer matches the pinned build.
    spec = find_spec('retainpdf_pipeline.ocr.document_schema.provider_adapters.paddle.translation_policy')
    if spec is None or spec.origin is None:
        raise RuntimeError('Installed RetainPDF policy could not be located')
    for path in {POLICY_PATH, Path(spec.origin)}:
        patch_policy(path)
