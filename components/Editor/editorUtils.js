export const blockTypes = [
  {
    slug: "paragraph",
    title: "Normal",
    toggle: (editor) => editor.commands.clearNodes(),
  },
  {
    slug: "h1",
    title: "Large heading",
    toggle: (editor) =>
      editor.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    slug: "h2",
    title: "Medium heading",
    toggle: (editor) =>
      editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    slug: "h3",
    title: "Small heading",
    toggle: (editor) =>
      editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    slug: "ol",
    title: "Ordered list",
    toggle: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    slug: "ul",
    title: "Unordered list",
    toggle: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    slug: "quote",
    title: "Quote",
    toggle: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    slug: "code",
    title: "Code block",
    toggle: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
];

export const alignTypes = [
  {
    slug: "align-left",
    title: "Left align",
    toggle: (editor) => editor.chain().focus().setTextAlign("left").run(),
  },
  {
    slug: "align-right",
    title: "Right align",
    toggle: (editor) => editor.chain().focus().setTextAlign("right").run(),
  },
  {
    slug: "align-center",
    title: "Center align",
    toggle: (editor) => editor.chain().focus().setTextAlign("center").run(),
  },
  {
    slug: "align-justify",
    title: "Justify align",
    toggle: (editor) => editor.chain().focus().setTextAlign("justify").run(),
  },
];

export const colorTypes = [
  {
    name: "red",
    hex: "#cb4335",
    text: "#fff",
  },
  {
    name: "yellow",
    hex: "#f1c40f",
    text: "#000",
  },
  {
    name: "blue",
    hex: "#2980d7",
    text: "#fff",
  },
  {
    name: "green",
    hex: "#28b463",
    text: "#000",
  },
  {
    name: "purple",
    hex: "#9933ff",
    text: "#fff",
  },
  {
    name: "orange",
    hex: "#d35400",
    text: "#fff",
  },
  {
    name: "pink",
    hex: "#ffc0cb",
    text: "#000",
  },
  {
    name: "teal",
    hex: "#008080",
    text: "#fff",
  },
  {
    name: "olive",
    hex: "#808000",
    text: "#fff",
  },
  {
    name: "navy",
    hex: "#000080",
    text: "#fff",
  },
  {
    name: "salmon",
    hex: "#fa8072",
    text: "#fff",
  },
  {
    name: "magenta",
    hex: "#ff00ff",
    text: "#fff",
  },
  {
    name: "cyan",
    hex: "#00ffff",
    text: "#000",
  },
  {
    name: "lightgray",
    hex: "#cccccc",
    text: "#000",
  },
  {
    name: "chocolate",
    hex: "#663300",
    text: "#fff",
  },
  {
    name: "black",
    hex: "#000000",
    text: "#fff",
  },
  {
    name: "white",
    hex: "#ffffff",
    text: "#000",
  },
  {
    name: "amsterdam",
    hex: "#006b57",
    text: "#fff",
  },
  {
    name: "paris",
    hex: "#005c90",
    text: "#fff",
  },
];
