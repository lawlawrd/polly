import { Plugin } from "prosemirror-state";
import { formatISO } from "date-fns";
import Image from "@tiptap/extension-image";

export default Image.extend({
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handleDOMEvents: {
            drop(view, event) {
              const hasFiles =
                event.dataTransfer &&
                event.dataTransfer.files &&
                event.dataTransfer.files.length;
              if (!hasFiles) return;

              const images = Array.from(event.dataTransfer.files).filter(
                (file) => /image/i.test(file.type),
              );

              if (images.length === 0) return;

              event.preventDefault();

              const { schema } = view.state;
              const coordinates = view.posAtCoords({
                left: event.clientX,
                top: event.clientY,
              });

              images.forEach((image) => {
                const reader = new FileReader();

                reader.onload = (readerEvent) => {
                  const node = schema.nodes.image.create({
                    src: readerEvent.target.result,
                  });
                  const transaction = view.state.tr.insert(
                    coordinates.pos,
                    node,
                  );
                  view.dispatch(transaction);
                };
                reader.readAsDataURL(image);
              });
            },
            async paste(view, event) {
              const hasFiles =
                event.clipboardData &&
                event.clipboardData.files &&
                event.clipboardData.files.length;
              if (!hasFiles) return;

              event.preventDefault();
              const { schema } = view.state;

              for (let i = 0; i < event.clipboardData.files.length; i++) {
                if (/image/i.test(event.clipboardData.items[i].type)) {
                  // console.log(event.clipboardData.items[i]);
                  let blob = event.clipboardData.items[i].getAsFile();
                  let extension = blob.name.split(".").pop();
                  let formData = new FormData();
                  formData.append(
                    "file",
                    blob,
                    `${formatISO(new Date())}.${extension}}`,
                  );

                  let uploadedImage = await fetch(
                    "/api/collections/upload/images",
                    {
                      method: "PUT",
                      body: formData,
                    },
                  )
                    .then((res) => res.json())
                    .then((json) => {
                      if (json.fileName && json.folderLocation)
                        return `${json.folderLocation}${json.fileName}`;
                    })
                    .catch((err) => console.log(err));
                  // console.log(uploadedImage);

                  const node = schema.nodes.image.create({
                    src: uploadedImage,
                  });
                  const transaction = view.state.tr.replaceSelectionWith(node);
                  view.dispatch(transaction);
                }
              }
            },
          },
        },
      }),
    ];
  },
});
