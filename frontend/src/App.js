import React, { useState } from "react";
import axios from "axios";
import "./App.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://compressor-backend.onrender.com";

function App() {
  const [file, setFile] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState("");

  const handleUpload = async (type) => {
    if (!file) {
      alert("Please upload a file first!");
      return;
    }

    const fileName = file.name;
    const fileExtension = fileName.split('.').pop().toLowerCase();

    if (type === "compress" && fileExtension !== "txt") {
      alert("Please select a .txt file for compression!");
      return;
    }

    if (type === "decompress" && fileExtension !== "bin") {
      alert("Please select a .bin file for decompression!");
      return;
    }
    
    const formData = new FormData();
    formData.append("file", file);
    formData.append("originalName", file.name);

    const endpoint = type === "compress" ? "compress" : "decompress";

    const response = await axios.post(
      `${BACKEND_URL}/${endpoint}`,
      formData,
      {
        responseType: "blob",
      }
    );

    const url = window.URL.createObjectURL(new Blob([response.data]));
    setDownloadUrl(url);
  };

  const getDownloadFileName = () => {
    if (!file) return '';
    const originalName = file.name;
    const baseName = originalName.substring(0, originalName.lastIndexOf('.'));
    return file.name.endsWith('.bin') ? `${baseName}.txt` : `${baseName}.bin`;
  };

  return (
    <div className="app">
      <h1>📦 File Compressor & Decompressor</h1>
      <div className="file-inputs">
        <input
          type="file"
          onChange={(e) => setFile(e.target.files[0])}
          accept=".txt,.bin"
        />
      </div>
      <div className="buttons">
        <button onClick={() => handleUpload("compress")}>Compress</button>
        <button onClick={() => handleUpload("decompress")}>Decompress</button>
        {downloadUrl && (
          <a href={downloadUrl} download={getDownloadFileName()}>
            <button>Download</button>
          </a>
        )}
      </div>
    </div>
  );
}

export default App;
