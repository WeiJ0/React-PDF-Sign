import { useEffect, useState, useRef } from 'react'
import { fabric } from "fabric";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist"
import { PDFDocument } from "pdf-lib";
import download from 'downloadjs';


const pdfjsWorker = import('pdfjs-dist/build/pdf.worker.entry');
import './App.css'

const Canvas = () => {
  const [drawing, setDrawing] = useState(false);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = 400;
    canvas.height = 200;
    canvas.style.width = '400px';
    canvas.style.height = '200px';
    ctx.fillStyle = "rgba(255,255,255,0)"
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctxRef.current = ctx
  }, [])

  const startDraw = ({ nativeEvent }) => {
    const { offsetX, offsetY } = nativeEvent;
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(offsetX, offsetY);
    setDrawing(true);
  };
  const stopDraw = () => {
    ctxRef.current.closePath();
    setDrawing(false);
  };
  const draw = ({ nativeEvent }) => {
    if (!drawing) return;
    const { offsetX, offsetY } = nativeEvent;
    ctxRef.current.lineTo(offsetX, offsetY);
    ctxRef.current.stroke();
  };
  const clearDraw = () => {
    ctxRef.current.clearRect(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );
  };

  const saveDraw = () => {
    localStorage.setItem('draw', canvasRef.current.toDataURL("image/png"));
  }

  return (
    <section>
      <canvas ref={canvasRef}
        style={{ 'border': '2px solid #000' }}
        onMouseDown={startDraw} onMouseUp={stopDraw} onMouseLeave={stopDraw} onMouseMove={draw}
        onTouchStart={startDraw} onTouchEnd={stopDraw} onTouchCancel={stopDraw} onTouchMove={draw}
      />
      <button onClick={clearDraw}>清除</button>
      <button onClick={saveDraw}>儲存</button>
    </section>
  )
}

const UploadPDF = () => {
  const [signSrc, setSignSrc] = useState(null);
  let pdfDocs;
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);

  const canvas = new fabric.Canvas(canvasRef.current)

  useEffect(() => {
    if (localStorage.getItem('draw'))
      setSignSrc(localStorage.getItem('draw'));
  }, [])


  const Base64Prefix = "data:application/pdf;base64,";
  GlobalWorkerOptions.workerSrc = pdfjsWorker;

  const readBlob = (blob) => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => res(reader.result));
    reader.addEventListener('error', () => rej);
    reader.readAsDataURL(blob);
  })

  const printPDF = async (pdfData) => {
    pdfData = await readBlob(pdfData);
    pdfDocs = await PDFDocument.load(pdfData);
    const data = atob(pdfData.substring(Base64Prefix.length));
    const pdfDoc = await getDocument({ data }).promise;
    const pdfPage = await pdfDoc.getPage(1);
    const viewport = pdfPage.getViewport({ scale: window.devicePixelRatio });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    canvas.height = viewport.height;
    canvas.width = viewport.width;
    const renderContext = {
      canvasContext: context,
      viewport,
    };
    const renderTask = pdfPage.render(renderContext);
    return renderTask.promise.then(() => canvas);
  }

  const pdf2Image = (pdfData) => new fabric.Image(pdfData, {
    id: 'rendPDF',
    scaleX: 1 / window.devicePixelRatio,
    scaleY: 1 / window.devicePixelRatio
  })

  const renderPDF = async (nativeEvent) => {
    let pdfFile = nativeEvent.target.files[0];
    canvas.requestRenderAll();
    const pdfData = await printPDF(pdfFile);
    const pdfImage = await pdf2Image(pdfData);
    canvas.setWidth(pdfImage.width);
    canvas.setHeight(pdfImage.height);
    canvas.setBackgroundImage(pdfImage, canvas.renderAll.bind(canvas));
    canvas.sendToBack();
  }

  const addSign = () => {
    if (!signSrc) return;

    fabric.Image.fromURL(signSrc, img => {
      id: 'sign',
        img.set({
          hoverCursor: 'default',
          selectable: true,
        })
      img.top = 400;
      img.scaleX = 0.5;
      img.scaleY = 0.5;
      canvas.add(img);
    })
  }

  const downloadPDF = async () => {
    const pages = pdfDocs.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();
    let json = canvas.toJSON();
    json.objects.forEach(async (item) => {
      const pngImage = await pdfDocs.embedPng(item.src);
      firstPage.drawImage(pngImage, {
        x: item.left,
        y: height - item.top - (item.height * item.scaleY),
        width: item.width * item.scaleX,
        height: item.height * item.scaleY,
      });
    })

    await download(await pdfDocs.save(), "pdf-lib_form_creation_example.pdf", "application/pdf");
  }

  return (
    <>
      <input type={'file'} accept={'application/pdf'} placeholder={'選擇 pdf'} onChange={renderPDF} />
      <button onClick={addSign}>加上簽名</button>
      <button onClick={downloadPDF}>下載</button>
      <canvas ref={canvasRef} />
    </>
  )
}


function App() {
  return (
    <div className="App">
      <UploadPDF />
      {/* <Canvas /> */}
    </div>
  )
}



export default App
