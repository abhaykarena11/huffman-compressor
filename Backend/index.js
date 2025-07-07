const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs").promises;
const app = express();

app.use(cors());
app.use(express.json());

const upload = multer({ dest: "uploads/" });

// Huffman Node Class
class HuffmanNode {
  constructor(char, freq) {
    this.char = char;
    this.freq = freq;
    this.left = null;
    this.right = null;
  }
}

// Build Huffman Tree
function buildHuffmanTree(freqMap) {
  let heap = Object.entries(freqMap).map(
    ([char, freq]) => new HuffmanNode(char, freq)
  );

  heap.sort((a, b) => a.freq - b.freq);

  while (heap.length > 1) {
    let left = heap.shift();
    let right = heap.shift();
    let newNode = new HuffmanNode(null, left.freq + right.freq);
    newNode.left = left;
    newNode.right = right;

    heap.push(newNode);
    heap.sort((a, b) => a.freq - b.freq);
  }

  return heap[0];
}

// Generate Huffman Codes
function generateCodes(node, prefix = "", codeMap = {}) {
  if (!node) return;

  if (node.char !== null) {
    codeMap[node.char] = prefix;
  }

  generateCodes(node.left, prefix + "0", codeMap);
  generateCodes(node.right, prefix + "1", codeMap);

  return codeMap;
}

// Serialize and Deserialize Huffman Tree
function serializeTree(node) {
  return node
    ? {
        char: node.char,
        freq: node.freq,
        left: serializeTree(node.left),
        right: serializeTree(node.right),
      }
    : null;
}

function deserializeTree(jsonTree) {
  return jsonTree
    ? Object.assign(new HuffmanNode(jsonTree.char, jsonTree.freq), {
        left: deserializeTree(jsonTree.left),
        right: deserializeTree(jsonTree.right),
      })
    : null;
}

// Compress text using Huffman Coding & Store Binary
async function compressFile(filePath) {
  const content = await fs.readFile(filePath, "utf-8");
  let freqMap = {};

  for (let char of content) {
    freqMap[char] = (freqMap[char] || 0) + 1;
  }

  let root = buildHuffmanTree(freqMap);
  let huffmanCodes = generateCodes(root);

  let encodedText = content
    .split("")
    .map((char) => huffmanCodes[char])
    .join("");

  // Pack bits into bytes
  const bytes = [];
  for (let i = 0; i < encodedText.length; i += 8) {
    const byte = encodedText.slice(i, i + 8).padEnd(8, '0');
    bytes.push(parseInt(byte, 2));
  }
  
  // Store the number of padding bits at the end
  const paddingBits = (8 - (encodedText.length % 8)) % 8;
  bytes.unshift(paddingBits);

  // Convert to buffer
  let binaryBuffer = Buffer.from(bytes);

  return { binaryBuffer, tree: serializeTree(root) };
}

// Decompress Huffman encoded binary file
async function decompressFile(binaryBuffer, treeJSON) {
  // Get padding bits from first byte
  const paddingBits = binaryBuffer[0];
  
  // Convert remaining bytes to binary string
  let encodedText = '';
  for (let i = 1; i < binaryBuffer.length; i++) {
    encodedText += binaryBuffer[i].toString(2).padStart(8, '0');
  }
  
  // Remove padding bits
  encodedText = encodedText.slice(0, -paddingBits);
  
  return decompress(encodedText, treeJSON);
}

// Huffman Decompression Logic
function decompress(encodedText, treeJSON) {
  let root = deserializeTree(treeJSON);
  let result = "";
  let node = root;

  for (let bit of encodedText) {
    node = bit === "0" ? node.left : node.right;
    if (node.char !== null) {
      result += node.char;
      node = root;
    }
  }

  return result;
}

// Compression Route
app.post("/compress", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const originalName = req.body.originalName || 'compressed';
    const baseName = originalName.substring(0, originalName.lastIndexOf('.'));
    const { binaryBuffer, tree } = await compressFile(filePath);
    const outPath = `uploads/${baseName}.bin`;

    // Create a combined buffer with tree data and compressed data
    const treeBuffer = Buffer.from(JSON.stringify(tree));
    const treeLengthBuffer = Buffer.alloc(4);
    treeLengthBuffer.writeUInt32BE(treeBuffer.length);
    
    // Combine: [tree length (4 bytes)][tree data][compressed data]
    const finalBuffer = Buffer.concat([treeLengthBuffer, treeBuffer, binaryBuffer]);

    await fs.writeFile(outPath, finalBuffer);

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}.bin"`);
    res.download(outPath, async () => {
      await fs.unlink(filePath);
      await fs.unlink(outPath);
    });
  } catch (error) {
    console.error("Compression error:", error);
    res.status(500).json({ message: "Error processing file", error: error.message });
  }
});

// Decompression Route
app.post("/decompress", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const originalName = req.body.originalName || 'decompressed';
    const baseName = originalName.substring(0, originalName.lastIndexOf('.'));
    const fileBuffer = await fs.readFile(filePath);

    // Read tree length (first 4 bytes)
    const treeLength = fileBuffer.readUInt32BE(0);
    
    // Extract tree data and compressed data
    const treeBuffer = fileBuffer.slice(4, 4 + treeLength);
    const compressedBuffer = fileBuffer.slice(4 + treeLength);
    
    const treeJSON = JSON.parse(treeBuffer.toString());
    const decompressed = await decompressFile(compressedBuffer, treeJSON);
    const outPath = `uploads/${baseName}.txt`;

    await fs.writeFile(outPath, decompressed);

    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${baseName}.txt"`);
    res.download(outPath, async () => {
      await fs.unlink(filePath);
      await fs.unlink(outPath);
    });
  } catch (error) {
    console.error("Decompression error:", error);
    res.status(500).json({ message: "Error processing file", error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
