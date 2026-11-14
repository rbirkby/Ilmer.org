---
name: optimise-images
description: Prepare and review image changes for Ilmer.org. Use whenever adding, generating, downloading, replacing, converting or committing images, or reviewing image assets, to require AVIF, minimise file sizes and exclude unused or unlinked files.
---

# Optimise images

## Requirements

- Encode every new or modified raster image as genuine AVIF with an `.avif` extension. Renaming another format is not conversion.
- Normally keep each image strictly below **200,000 bytes (200 KB)**.
- Images from 200,000 to 999,999 bytes require a concrete reason, such as preserving readable map labels or historical document text, after attempting further optimisation. Report the reason and exact size.
- Images of **1,000,000 bytes (1 MB) or more** are exceptional: stop and obtain explicit user approval for that specific file, size and justification before including it in a commit.
- Do not silently exempt SVGs, favicons, animations or assets whose consumers cannot use AVIF. Preserve required functionality and ask the user before introducing or changing an image that must remain in another format.
- Do not bulk-convert or remove unrelated existing assets unless asked. Apply these requirements to the current task's image additions and modifications; flag relevant legacy exceptions rather than expanding the task.

## Before adding an image

1. Establish where it will actually be displayed or linked. Reuse an existing suitable asset rather than adding a duplicate.
2. Inspect the consumer, required display dimensions and any zoom or full-size viewing requirements. Preserve legibility, transparency and required animation.
3. Keep downloads, source originals, conversion experiments and comparison images in temporary storage outside the repository. Do not retain them as repository assets merely for provenance or possible future use.
4. Inspect the working tree. Never delete or stage unrelated user changes.

## Convert and optimise

Prefer **Squoosh** for AVIF encoding:

1. Open the source in Squoosh using an available, approved browser or local workflow. Keep image processing local; do not upload source images to a remote conversion service.
2. Select **AVIF** as the output format. Use its resize controls to match the actual viewing requirement.
3. Adjust quality and encoder settings while comparing the original and compressed previews, especially fine detail and document text.
4. Export the candidate to temporary storage outside the repository. Measure the exported file, rather than relying solely on the preview's rounded size.

Do not add Squoosh packages, a lockfile or a wrapper script to the repository for a one-off conversion. If Squoosh cannot be used with the available tools, disclose that limitation before using a local fallback such as ImageMagick with AVIF support. Check fallback support first:

```sh
magick -list format | grep -i AVIF
```

For an ImageMagick fallback, for example:

```sh
magick /absolute/path/to/source.jpg -auto-orient -resize '1600x1600>' -strip -quality 55 /absolute/temporary/path/candidate.avif
wc -c < /absolute/temporary/path/candidate.avif
magick identify /absolute/temporary/path/candidate.avif
```

The fallback dimensions and quality above are starting points, not required settings, and quality scales are encoder-specific. Regardless of encoder, for each candidate:

1. Resize to the smallest dimensions that meet the real viewing requirement, allowing for high-density displays where appropriate. Never upscale needlessly.
2. Remove unnecessary metadata, retaining any required attribution in the existing content or provenance mechanism. Preserve correct colour appearance when removing profiles.
3. Adjust AVIF quality and dimensions iteratively until below 200,000 bytes where practical. Encode each candidate from the original, not from an already lossy intermediate.
4. Inspect the decoded image at its intended display size and any required zoom level. Check text, map labels, fine detail, orientation, colours and transparency; a byte-count pass alone is insufficient.
5. Measure the final file's exact byte count. Follow the exception requirements above rather than silently accepting an oversized result.
6. Copy only the chosen, validated AVIF into the appropriate existing asset directory.

If no suitable encoder is available, report the blocker and obtain approval before installing tooling. Do not substitute another format or pretend optimisation succeeded.

## Integrate without unused files

- Main-site images normally live under `public/images/` and are referenced as `/images/...`: Eleventy copies `public/` to the site root. Preserve existing naming and directory conventions.
- Update every affected consumer when changing a path or extension: Markdown, HTML/Liquid, CSS URLs, `srcset`, front matter, JSON data, JavaScript loaders, texture references and direct download links as applicable.
- Every image added in the proposed commit must have a real use or link from maintained site or application content. A mention only in this skill, a comment, a provenance note, a test fixture unrelated to actual use, or a generated output directory does not establish use.
- For dynamically constructed paths, trace the data and loader to the rendered consumer. An exact filename search alone cannot establish that an image is unused.
- Do not add unused alternatives, duplicate resolutions without consumers, original JPEG/PNG downloads, contact sheets, screenshots, backup copies or conversion intermediates.
- When replacing an image, remove the superseded source-controlled asset only after verifying all consumers have moved and it is not needed elsewhere. Do not remove unrelated pre-existing unreferenced images as part of this workflow.
- Do not commit generated `_site/` output or introduce manifests, reports or helper files solely to record compliance.

## Verify before committing or handing off

1. Inspect both staged and unstaged changes, plus untracked files:

   ```sh
   git status --short
   git diff --name-status
   git diff --cached --name-status
   ```

2. Review every added or modified image in the proposed changes, including assets outside `public/images/`. Verify genuine AVIF encoding, successful decoding, exact bytes and visual quality.
3. For each added image, identify its actual consuming page, component or direct link. Search maintained sources, excluding generated output and dependencies, then trace indirect references where necessary. If no real use exists, leave it out of the commit; remove only task-created unused files.
4. When site assets or references change, run:

   ```sh
   npm run build
   npm run link-check:internal
   ```

   Inspect the affected rendered page or application as well, including CSS backgrounds and JavaScript-loaded images that a link checker may miss. Verify the served image URL resolves and displays correctly.

5. Review the final diff and staged file list. If committing was requested, stage only explicitly intended paths, not a blanket `git add .`.
6. Report final image paths, exact byte sizes, actual consumers, validation results and any approved exceptions. Do not claim automatic enforcement: this skill guides agent work; it is not a CI check or commit hook.
