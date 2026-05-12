import { type SurveyData } from "~/lib/dxf";

type SimaPoint = {
  no: number;
  name: string;
  x: number;
  y: number;
};

const cleanText = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/Ⅰ/g, "I")
    .replace(/Ⅱ/g, "II")
    .replace(/Ⅲ/g, "III")
    .replace(/Ⅳ/g, "IV")
    .replace(/Ⅴ/g, "V")
    .replace(/Ⅵ/g, "VI")
    .replace(/Ⅶ/g, "VII")
    .replace(/Ⅷ/g, "VIII")
    .replace(/Ⅸ/g, "IX")
    .replace(/Ⅹ/g, "X")
    .replace(/,/g, " ")
    .replace(/\r?\n/g, " ")
    .trim();

const coord = (value: number) => value.toFixed(3);

export function generateSIMA(data: SurveyData): string {
  const rows: string[][] = [];
  const points: SimaPoint[] = [];
  const parcelPointNos = new Map<string, number[]>();

  const addPoint = (name: string, x: number, y: number) => {
    const no = points.length + 1;
    points.push({ no, name: cleanText(name) || String(no), x, y });
    return no;
  };

  for (const parcel of data.parcels) {
    const pointNos: number[] = [];
    for (const point of parcel.coordinates) {
      pointNos.push(addPoint(point.point, point.x, point.y));
    }
    parcelPointNos.set(parcel.parcel_id, pointNos);
  }

  for (const point of data.reference_points) {
    addPoint(point.point, point.x, point.y);
  }

  rows.push([
    "G00",
    "1",
    cleanText(data.survey_metadata.location_id),
    "地積測量図OCR",
  ]);
  rows.push([
    "Z00",
    cleanText(data.survey_metadata.geodetic_system),
    cleanText(data.survey_metadata.coordinate_system),
  ]);

  rows.push(["A00"]);
  for (const point of points) {
    rows.push([
      "A01",
      String(point.no),
      point.name,
      coord(point.x),
      coord(point.y),
      "0.000",
    ]);
  }
  rows.push(["A99"]);

  for (const parcel of data.parcels) {
    rows.push([
      "D00",
      cleanText(parcel.parcel_id),
      cleanText(parcel.area_m2.toFixed(3)),
    ]);
    const pointNos = parcelPointNos.get(parcel.parcel_id) ?? [];
    for (const no of pointNos) {
      rows.push(["B01", String(no)]);
    }
    rows.push(["D99"]);
  }

  return `${rows.map((row) => row.map(cleanText).join(",")).join("\r\n")}\r\n`;
}
