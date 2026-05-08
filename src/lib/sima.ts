import { type SurveyData } from "~/lib/dxf";

type SimaPoint = {
  no: number;
  name: string;
  x: number;
  y: number;
};

const cleanText = (value: string | number | null | undefined) =>
  String(value ?? "")
    .replace(/,/g, " ")
    .replace(/\r?\n/g, " ")
    .trim();

const coord = (value: number) => value.toFixed(3);

const uniqueKey = (x: number, y: number) => `${coord(x)},${coord(y)}`;

export function generateSIMA(data: SurveyData): string {
  const rows: string[][] = [];
  const pointNoByKey = new Map<string, number>();
  const points: SimaPoint[] = [];

  const addPoint = (name: string, x: number, y: number) => {
    const key = uniqueKey(x, y);
    const existingNo = pointNoByKey.get(key);
    if (existingNo) return existingNo;

    const no = points.length + 1;
    pointNoByKey.set(key, no);
    points.push({ no, name: cleanText(name) || String(no), x, y });
    return no;
  };

  for (const parcel of data.parcels) {
    for (const point of parcel.coordinates) {
      addPoint(point.point, point.x, point.y);
    }
  }

  for (const point of data.reference_points) {
    addPoint(point.point, point.x, point.y);
  }

  rows.push([
    "G00",
    "1",
    cleanText(data.survey_metadata.location_id),
    "Zahyoc",
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
    for (const point of parcel.coordinates) {
      const no = pointNoByKey.get(uniqueKey(point.x, point.y));
      if (no) rows.push(["B01", String(no)]);
    }
    rows.push(["D99"]);
  }

  return `${rows.map((row) => row.map(cleanText).join(",")).join("\r\n")}\r\n`;
}
