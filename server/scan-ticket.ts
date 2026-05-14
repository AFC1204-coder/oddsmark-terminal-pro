import type { Express, Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY!,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL!,
  },
});

const SYSTEM_PROMPT = `Eres un experto analizador de tickets de apuestas deportivas. Tu trabajo es extraer información de imágenes de tickets de apuestas, incluso si están borrosas o parcialmente visibles.

INSTRUCCIONES:
1. Analiza la imagen del ticket de apuesta
2. Extrae la siguiente información:
   - deporte: El deporte (Futbol, Basket, Tenis, Otros)
   - competicion: La liga o competición (ej: LaLiga, Premier League, Champions, NBA, ATP)
   - evento: El partido o evento (ej: Real Madrid vs Barcelona)
   - mercado: El tipo de apuesta (ej: 1X2, Over/Under 2.5, Handicap +1.5)
   - cuota: La cuota decimal como número (ej: 1.85)
   - stake: El importe apostado como número (ej: 10)
   - fecha: La fecha del evento en formato YYYY-MM-DD

3. Si no puedes leer algún campo con certeza, usa los siguientes valores por defecto:
   - deporte: "Futbol"
   - competicion: "Otros"
   - cuota: 1.50
   - stake: 1

RESPONDE ÚNICAMENTE CON UN JSON VÁLIDO sin explicaciones adicionales:
{
  "deporte": "string",
  "competicion": "string", 
  "evento": "string",
  "mercado": "string",
  "cuota": number,
  "stake": number,
  "fecha": "YYYY-MM-DD"
}`;

export interface ScanTicketResult {
  deporte: string;
  competicion: string;
  evento: string;
  mercado: string;
  cuota: number;
  stake: number;
  fecha: string;
}

export function registerScanTicketRoutes(app: Express, isAuthenticated: any): void {
  app.post("/api/scan-ticket", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { image } = req.body;

      if (!image) {
        return res.status(400).json({ error: "Se requiere una imagen en base64" });
      }

      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      const mimeType = image.match(/^data:(image\/\w+);base64,/)?.[1] || "image/jpeg";

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: SYSTEM_PROMPT },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              { text: "Analiza este ticket de apuesta y extrae la información." },
            ],
          },
        ],
      });

      const text = response.text || "";
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return res.status(500).json({ error: "No se pudo extraer información del ticket" });
      }

      const parsed: ScanTicketResult = JSON.parse(jsonMatch[0]);

      if (typeof parsed.cuota === "string") {
        parsed.cuota = parseFloat(parsed.cuota) || 1.5;
      }
      if (typeof parsed.stake === "string") {
        parsed.stake = parseFloat(parsed.stake) || 1;
      }

      if (!parsed.fecha) {
        parsed.fecha = new Date().toISOString().split("T")[0];
      }

      res.json(parsed);
    } catch (error) {
      console.error("Error scanning ticket:", error);
      res.status(500).json({ 
        error: "Error al analizar el ticket",
        details: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });
}
