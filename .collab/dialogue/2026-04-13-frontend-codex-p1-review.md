Verdict: NEEDS-FIX

1) Bold误伤：步骤序号被批量降为font-semibold，与定稿“步骤序号保留bold”冲突。例：AskyourpdfAltsClient.tsx:116/165；同类在alternatives、compare、use-cases多页复现。
2) Dark对比：HeroSection.tsx:75（URL栏11px）text-zinc-400 on bg-zinc-700，对比约4.07:1，低于4.5:1。

其余通过：Hero 60/40；<lg上下堆叠且截图在CTA后；group-hover修复正确；HomePageClient已删Showcase且无遗留import；未改字体库。Hero去font-display（现font-semibold）方向可接受。
