
const { MongoClient } = require('mongodb');
const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const moment = require('moment');

const mongoURL = process.env.MONGO_URL || "mongodb://localhost:27017";
const dbName = "AgroclimaAi";
const auditCollection = "auditorias";

// Función para conectar a MongoDB
const connectToMongoDB = async () => {
  try {
    const client = await MongoClient.connect(mongoURL);
    console.log("Conectado a MongoDB en AuditoriaController");
    const db = client.db(dbName);
    return { client, db };
  } catch (error) {
    console.error("Error conectando a MongoDB:", error);
    throw error;
  }
};


const registrarAuditoria = async (usuario, accion, detalles = {}) => {
  try {
    const client = new MongoClient(mongoURL);
    await client.connect();
    const db = client.db(dbName);

    await db.collection(auditCollection).insertOne({
      usuario,
      accion,
      detalles,
      fecha: new Date(),
    });

    await client.close();
  } catch (err) {
    console.error("❌ Error al registrar auditoría:", err);
  }
};


// ✅ Listar en JSON (para frontend)
const listarAuditorias = async (req, res) => {
  let client;
  try {
    const { client: mongoClient, db } = await connectToMongoDB();
    client = mongoClient;
    const auditorias = await db
      .collection(auditCollection)
      .find()
      .sort({ fecha: -1 })
      .toArray();

    res.status(200).json(auditorias);
  } catch (err) {
    console.error("Error al consultar auditorías:", err);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    if (client) {
      await client.close();
    }
  }
};

const exportarAuditorias = async (req, res) => {
  const { type } = req.params;
  const { startDate, endDate } = req.query;
  let client;

  if (!startDate || !endDate) {
    return res.status(400).json({ error: "Fechas requeridas" });
  }

  try {
    const { client: mongoClient, db } = await connectToMongoDB();
    client = mongoClient;

    const auditorias = await db
      .collection(auditCollection)
      .find({
        fecha: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      })
      .sort({ fecha: -1 })
      .toArray();

    if (!auditorias.length) {
      return res.status(404).json({ error: "No hay registros en el rango de fechas" });
    }

    // 🔸 Exportar CSV
    if (type === "csv") {
      const parser = new Parser();
      const csv = parser.parse(auditorias);
      res.setHeader("Content-Disposition", "attachment; filename=auditorias.csv");
      res.setHeader("Content-Type", "text/csv");
      return res.send(csv);
    }

    // 🔸 Exportar Excel
    if (type === "xlsx") {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Auditorías");

      sheet.columns = [
        { header: "Usuario", key: "usuario", width: 25 },
        { header: "Acción", key: "accion", width: 30 },
        { header: "Detalles", key: "detalles", width: 50 },
        { header: "Fecha", key: "fecha", width: 30 },
      ];

      auditorias.forEach((a) => {
        sheet.addRow({
          usuario: a.usuario,
          accion: a.accion,
          detalles: JSON.stringify(a.detalles || {}, null, 2),
          fecha: moment(a.fecha).format("YYYY-MM-DD HH:mm:ss"),
        });
      });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", "attachment; filename=auditorias.xlsx");
      await workbook.xlsx.write(res);
      return res.end();
    }

    // 🔸 Exportar PDF
    if (type === "pdf") {
      const doc = new PDFDocument({ margin: 30, size: "A4" });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=auditorias.pdf");
      doc.pipe(res);

      doc.fontSize(18).text("Reporte de Auditoría", { align: "center" });
      doc.moveDown();

      auditorias.forEach((a) => {
        doc
          .fontSize(10)
          .text(`Usuario: ${a.usuario || "Sistema"}`)
          .text(`Acción: ${a.accion}`)
          .text(`Fecha: ${moment(a.fecha).format("YYYY-MM-DD HH:mm:ss")}`)
          .text(`Detalles: ${JSON.stringify(a.detalles || {}, null, 2)}`)
          .moveDown();
      });

      doc.end();
      return;
    }

    res.status(400).json({ error: "Tipo de archivo no soportado" });
  } catch (err) {
    console.error("❌ Error al exportar auditorías:", err);
    res.status(500).json({ error: "Error en el servidor" });
  } finally {
    if (client) {
      await client.close();
    }
  }
};

module.exports = {
  listarAuditorias,
  exportarAuditorias,
  registrarAuditoria
};
