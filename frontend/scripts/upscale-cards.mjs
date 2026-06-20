#!/usr/bin/env node
// Generates high-resolution @2x card assets into public/cards/2x/.
//
// The shipped card art is only 300x527, which is smaller than the canvas
// backing store needs on high-DPR phones (a ~214px-wide card at DPR 3 needs a
// ~642px buffer). Feeding the canvas a larger asset removes the browser's
// on-the-fly upscale blur. Note: when the only originals are 300px, this step
// resamples (Lanczos + light sharpening) and cannot invent detail — drop true
// hi-res originals into public/cards/ and re-run to get genuine extra detail.

import { execFile } from "node:child_process"
import { mkdir, readdir, stat } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

const run = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))

const SRC_DIR = resolve(__dirname, "..", "public", "cards")
const OUT_DIR = join(SRC_DIR, "2x")
const SCALE = 2

async function ensureMagick() {
  try {
    await run("magick", ["-version"])
    return "magick"
  } catch {
    try {
      await run("convert", ["-version"])
      return "convert"
    } catch {
      throw new Error(
        "ImageMagick not found. Install it (e.g. `brew install imagemagick`) and re-run."
      )
    }
  }
}

async function main() {
  const bin = await ensureMagick()
  await mkdir(OUT_DIR, { recursive: true })

  const entries = await readdir(SRC_DIR)
  const webps = entries.filter((f) => f.toLowerCase().endsWith(".webp"))

  if (webps.length === 0) {
    console.log("No source WebPs found in", SRC_DIR)
    return
  }

  let done = 0
  for (const file of webps) {
    const src = join(SRC_DIR, file)
    const out = join(OUT_DIR, file)

    const args = [
      src,
      "-filter",
      "Lanczos",
      "-resize",
      `${SCALE * 100}%`,
      "-unsharp",
      "0x0.6+0.6+0.02",
      "-strip",
      "-quality",
      "88",
      out,
    ]
    await run(bin, args)
    done += 1
    process.stdout.write(`\r  upscaled ${done}/${webps.length}`)
  }
  process.stdout.write("\n")
  console.log(`Wrote ${done} @${SCALE}x assets to ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err.message ?? err)
  process.exitCode = 1
})
