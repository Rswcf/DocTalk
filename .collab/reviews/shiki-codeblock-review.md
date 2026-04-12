REQUEST_CHANGES

- Medium: `CodeBlock` can render stale highlighted HTML after `code`/`language` changes because loading does not clear prior `html` state.  
  Refs: [MessageBubble.tsx:103](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/MessageBubble.tsx:103), [MessageBubble.tsx:106](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/MessageBubble.tsx:106), [MessageBubble.tsx:139](/Users/mayijie/Projects/Code/010_DocTalk/frontend/src/components/Chat/MessageBubble.tsx:139)

Other requested checks look good: XSS surface is acceptable with current Shiki escaping, cancel flag usage avoids post-unmount state writes, unknown languages fall back to `text`, CSS var theming matches `defaultColor:false`, and `import('shiki')` is client-lazy.