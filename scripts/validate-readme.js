const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const projectRoot = process.cwd();
const readmePath = path.join(projectRoot, "README.md");
const tempDir = path.join(projectRoot, "temp-validation-readme");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function createTsConfig(dir) {
  const tsconfigContent = JSON.stringify(
    {
      compilerOptions: {
        allowJs: true,
        checkJs: true,
        noEmit: true,
        esModuleInterop: true,
        forceConsistentCasingInFileNames: true,
        strict: true,
        noImplicitAny: false,
        lib: ["es2020", "dom", "esnext.asynciterable"],
        module: "commonjs",
        target: "es2020",
        baseUrl: projectRoot,
        paths: {
          "kuber-client": ["src/index.ts"],
          "kuber-client/*": ["src/*"],
          "kuber-client/browser": ["src/browser.ts"],
          "@libcardano/wallet": ["node_modules/libcardano-wallet"],
        },
      },
      include: ["./**/*"],
    },
    null,
    2,
  );
  fs.writeFileSync(path.join(dir, "tsconfig.json"), tsconfigContent);
}

function extractCodeBlocks(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.split("\n");
  const codeBlocks = [];
  let inCodeBlock = false;
  let codeBlockLang = "";
  let codeBlockContent = [];
  let codeBlockStartLine = 0;

  const codeBlockStartRegex = /^```(typescript|javascript|ts|js)\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const codeBlockStartMatch = line.match(codeBlockStartRegex);
    if (codeBlockStartMatch && !inCodeBlock) {
      inCodeBlock = true;
      codeBlockLang = codeBlockStartMatch[1];
      codeBlockContent = [];
      codeBlockStartLine = i + 1;
    } else if (line.startsWith("```") && inCodeBlock) {
      inCodeBlock = false;
      codeBlocks.push({
        lang: codeBlockLang,
        code: codeBlockContent.join("\n"),
        line: codeBlockStartLine,
      });
      codeBlockContent = [];
      codeBlockLang = "";
    } else if (inCodeBlock) {
      codeBlockContent.push(line);
    }
  }

  return codeBlocks;
}

function validateReadme() {
  console.log("Starting README code example validation...");
  if (!fs.existsSync(readmePath)) {
    console.log("README.md not found, skipping validation.");
    return;
  }

  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  ensureDir(tempDir);
  createTsConfig(tempDir);

  const codeBlocks = extractCodeBlocks(readmePath);
  if (codeBlocks.length === 0) {
    console.log("No TypeScript or JavaScript code snippets found in README.md.");
    return;
  }

  const snippetMap = new Map();
  codeBlocks.forEach((block, index) => {
    const isTs = block.lang === "typescript" || block.lang === "ts";
    const tempFileName = `readme_${index}.${isTs ? "ts" : "js"}`;
    const tempFilePath = path.join(tempDir, tempFileName);

    const wrappedCode = `\n// Original file: README.md (line ${block.line})\n${block.code}\n`;
    fs.writeFileSync(tempFilePath, wrappedCode);
    snippetMap.set(path.resolve(tempFilePath), block.line);
  });

  try {
    const tscCommand = `npx tsc --noEmit --project ${tempDir} --pretty false`;
    console.log(`Executing static type validation command: ${tscCommand}`);
    const tscOutput = execSync(tscCommand, { encoding: "utf8" });
    console.log("TypeScript Compiler Output (stdout):");
    console.log(tscOutput);
    console.log("All README code snippets passed static type validation!");
  } catch (error) {
    console.error("TypeScript static type validation failed:");
    const tscErrorOutput = error.stdout ? error.stdout.toString() : error.message;
    const errorLines = tscErrorOutput.split("\n");
    errorLines.forEach((line) => {
      const match = line.match(/^(.*?)\((\d+),(\d+)\): error (TS\d+): (.*)$/);
      if (match) {
        const [, filePathInTemp, lineInTemp, , errorCode, errorMessage] = match;
        const resolvedTempFilePath = path.resolve(filePathInTemp);
        const originalLine = snippetMap.get(resolvedTempFilePath);
        if (originalLine) {
          const adjustedLine = parseInt(lineInTemp, 10) - 2;
          const tempSnippetPath = path.relative(projectRoot, resolvedTempFilePath);
          console.error(
            `README.md:${originalLine + adjustedLine} (${tempSnippetPath}:${lineInTemp}) - error ${errorCode}: ${errorMessage}`,
          );
        } else {
          console.error(line);
        }
      } else if (line.trim()) {
        console.error(line);
      }
    });
    throw new Error("README validation failed due to static type errors.");
  }
}

validateReadme();
