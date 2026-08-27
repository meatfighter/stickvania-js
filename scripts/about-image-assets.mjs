import sharp from "sharp";
import { join } from "node:path";
import { ensureDirectory, writeAtomicBinaryFile } from "./build-utils.mjs";

export const titleImageWidth = 750;
export const titleImageHeight = 562;
export const titleImageSizes = "min(750px, calc(100vw - 2rem))";

const titleVariants = [
    { name: "750", width: 750 },
    { name: "1448", width: 1448 }
];
const titleModes = [
    { name: "light", channel: 0 },
    { name: "dark", channel: 255 }
];

async function renderTransparentTitleVariant(sourcePath, targetPath, width, mode, format) {
    const image = sharp(sourcePath).resize({
        width,
        kernel: sharp.kernel.lanczos3,
        withoutEnlargement: true
    });
    const { data, info } = await image.removeAlpha().raw().toBuffer({
        resolveWithObject: true
    });
    const output = Buffer.alloc(info.width * info.height * 4);

    for (let source = 0, target = 0; source < data.length; source += info.channels, target += 4) {
        const alpha = Math.max(data[source], data[source + 1], data[source + 2]);
        output[target] = mode.channel;
        output[target + 1] = mode.channel;
        output[target + 2] = mode.channel;
        output[target + 3] = alpha;
    }

    const pipeline = sharp(output, {
        raw: {
            width: info.width,
            height: info.height,
            channels: 4
        }
    });

    const encoded =
        format === "png"
            ? await pipeline.png({ adaptiveFiltering: true, compressionLevel: 9 }).toBuffer()
            : await pipeline.webp({ lossless: true, effort: 6 }).toBuffer();

    writeAtomicBinaryFile(targetPath, encoded, { label: "about transparent title image output file" });
}

export async function generateAboutImageAssets(sourceAssetsDir, outputAssetsDir) {
    const sourceTitlePath = join(sourceAssetsDir, "title.png");
    ensureDirectory(outputAssetsDir);

    for (const mode of titleModes) {
        for (const variant of titleVariants) {
            for (const format of ["png", "webp"]) {
                await renderTransparentTitleVariant(
                    sourceTitlePath,
                    join(outputAssetsDir, `title-${mode.name}-${variant.name}.${format}`),
                    variant.width,
                    mode,
                    format
                );
            }
        }
    }
}
