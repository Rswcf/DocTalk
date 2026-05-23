#!/usr/bin/env node
/* Static reachability audit for retired vs reachable structured workflow UI. */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../..");
const frontendSrc = path.join(root, "frontend/src");

function walk(dir, predicate = () => true) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      out.push(...walk(full, predicate));
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

function rel(file) {
  return path.relative(root, file);
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function findMatches(pattern, files) {
  const matches = [];
  for (const file of files) {
    const text = read(file);
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (pattern.test(line)) {
        matches.push({ file: rel(file), line: index + 1, text: line.trim() });
      }
      pattern.lastIndex = 0;
    });
  }
  return matches;
}

function contains(file, snippet) {
  return fs.existsSync(file) && read(file).includes(snippet);
}

function main() {
  const tsxFiles = walk(frontendSrc, (file) => /\.(tsx|ts)$/.test(file));
  const extractionPanel = path.join(frontendSrc, "components/Extraction/ExtractionPanel.tsx");
  const questionTemplatesPanel = path.join(frontendSrc, "components/Templates/QuestionTemplatesPanel.tsx");
  const collectionPage = path.join(frontendSrc, "app/collections/[collectionId]/page.tsx");
  const readerPage = path.join(frontendSrc, "app/d/[documentId]/DocumentReaderPageClient.tsx");
  const messageBubble = path.join(frontendSrc, "components/Chat/MessageBubble.tsx");
  const architectureZh = path.join(root, "docs/ARCHITECTURE.zh.md");
  const roadmap = path.join(root, "docs/research/feature-roadmap.md");

  const externalTsxFiles = tsxFiles.filter((file) => file !== extractionPanel);
  const extractionImports = findMatches(/ExtractionPanel|components\/Extraction|Extraction\/ExtractionPanel/, externalTsxFiles);
  const extractionJsx = findMatches(/<ExtractionPanel\b/, externalTsxFiles);
  const questionTemplateImports = findMatches(/QuestionTemplatesPanel/, externalTsxFiles);
  const chatArtifactReachability = findMatches(/ChatArtifactCard|message\.artifacts|artifacts\?\.map/, tsxFiles);

  const checks = [
    {
      name: "extraction_panel_file_exists",
      pass: fs.existsSync(extractionPanel),
      evidence: rel(extractionPanel),
    },
    {
      name: "extraction_panel_has_no_external_imports",
      pass: extractionImports.length === 0,
      evidence: extractionImports,
    },
    {
      name: "extraction_panel_has_no_external_jsx_mount",
      pass: extractionJsx.length === 0,
      evidence: extractionJsx,
    },
    {
      name: "question_templates_reachable_from_collection_page",
      pass: contains(collectionPage, "QuestionTemplatesPanel") && contains(collectionPage, "templates.tab"),
      evidence: rel(collectionPage),
    },
    {
      name: "reader_uses_chat_panel_not_extraction_panel",
      pass: contains(readerPage, "ChatPanel") && !contains(readerPage, "ExtractionPanel"),
      evidence: rel(readerPage),
    },
    {
      name: "chat_artifact_cards_reachable_from_messages",
      pass: contains(messageBubble, "ChatArtifactCard") && contains(messageBubble, "message.artifacts"),
      evidence: chatArtifactReachability.map((item) => ({ file: item.file, line: item.line, text: item.text })),
    },
    {
      name: "architecture_documents_retired_extract_workspace",
      pass: contains(architectureZh, "不再显示 Brief/Extract 主标签")
        && contains(roadmap, "hidden Brief/Extract tabs"),
      evidence: [rel(architectureZh), rel(roadmap)],
    },
    {
      name: "question_templates_panel_file_exists",
      pass: fs.existsSync(questionTemplatesPanel),
      evidence: rel(questionTemplatesPanel),
    },
  ];

  const report = {
    generated_at: new Date().toISOString(),
    scope: "frontend structured workflow reachability",
    files_scanned: tsxFiles.length,
    extraction_panel: rel(extractionPanel),
    active_reachable_surfaces: [
      "frontend/src/components/Chat/ChatArtifactCard.tsx via MessageBubble message.artifacts",
      "frontend/src/components/Templates/QuestionTemplatesPanel.tsx via app/collections/[collectionId]/page.tsx",
    ],
    retired_orphaned_surface: "frontend/src/components/Extraction/ExtractionPanel.tsx",
    checks,
    summary: {
      total: checks.length,
      passed: checks.filter((check) => check.pass).length,
      failed: checks.filter((check) => !check.pass).length,
    },
  };
  report.result = report.summary.failed === 0 ? "pass" : "fail";

  const outArg = process.argv.find((arg) => arg.startsWith("--json-out="));
  if (outArg) {
    const out = path.resolve(root, outArg.split("=", 2)[1]);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + "\n");
  }

  console.log(`FRONTEND_REACHABILITY_AUDIT ${report.result.toUpperCase()}: ${report.summary.passed}/${report.summary.total}`);
  if (report.result !== "pass") process.exit(1);
}

main();
