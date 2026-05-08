export type Coordinate = {
  point: string;
  x: number;
  y: number;
  marker_type?: string;
};

export type Parcel = {
  parcel_id: string;
  area_m2: number;
  calculation_method?:
    | "coordinate"
    | "triangulation"
    | "residual"
    | "area_only"
    | "unknown";
  calculation_notes?: string;
  coordinates: Coordinate[];
};

export type SurveyData = {
  survey_metadata: {
    location_id: string;
    geodetic_system: string;
    coordinate_system: string;
    scale_factor: number;
    survey_date: string;
    surveyor?: string;
    creator_organization?: string;
    applicant?: string;
    calculation_method?:
      | "coordinate"
      | "triangulation"
      | "residual"
      | "mixed"
      | "area_only"
      | "unknown";
    method_confidence?: number;
    method_evidence?: string[];
    coordinate_status?:
      | "public_coordinates"
      | "local_coordinates"
      | "no_coordinates"
      | "unknown";
    document_type?:
      | "survey_map"
      | "cadastral_map"
      | "boundary_photo"
      | "unknown";
  };
  parcels: Parcel[];
  reference_points: Coordinate[];
  adjacent_parcels: string[];
};

// 日本の測量座標系: X=北方向(northing), Y=東方向(easting)
// DXF座標系:        X=東方向(easting),  Y=北方向(northing)
const dx = (surveyY: number) => surveyY.toFixed(3);
const dy = (surveyX: number) => surveyX.toFixed(3);

const PARCEL_COLORS = ["7", "1", "3", "4", "6"] as const;

// レイヤー名をR12互換にする（スペース→アンダースコア、31文字以内）
const safeName = (s: string) => s.replace(/\s+/g, "_").slice(0, 31);

export function generateDXF(data: SurveyData): string {
  const L: string[] = [];
  // DXF: グループコードと値を交互に1行ずつ出力
  const w = (...args: (string | number)[]) =>
    args.forEach((a) => L.push(String(a)));

  const allPts = [
    ...data.parcels.flatMap((p) => p.coordinates),
    ...data.reference_points,
  ];
  if (allPts.length === 0) return "";

  // DXF座標での範囲計算（survey Y → DXF X, survey X → DXF Y）
  const dxfXs = allPts.map((p) => p.y);
  const dxfYs = allPts.map((p) => p.x);
  const minDX = Math.min(...dxfXs);
  const maxDX = Math.max(...dxfXs);
  const minDY = Math.min(...dxfYs);
  const maxDY = Math.max(...dxfYs);
  const range = Math.max(maxDX - minDX, maxDY - minDY, 1);
  const th = (range * 0.008).toFixed(2);
  const offset = parseFloat(th) * 1.5;

  // ── HEADER ──────────────────────────────────────────────────
  w("0", "SECTION");
  w("2", "HEADER");
  w("9", "$ACADVER");
  w("1", "AC1009"); // R12: 最も互換性が高い
  w("9", "$EXTMIN");
  w("10", minDX.toFixed(3));
  w("20", minDY.toFixed(3));
  w("9", "$EXTMAX");
  w("10", maxDX.toFixed(3));
  w("20", maxDY.toFixed(3));
  w("9", "$DWGCODEPAGE");
  w("3", "ANSI_932"); // Shift-JIS
  w("9", "$LUNITS");
  w("70", "2"); // decimal
  w("9", "$LUPREC");
  w("70", "3"); // 小数3桁
  w("0", "ENDSEC");

  // ── TABLES ──────────────────────────────────────────────────
  w("0", "SECTION");
  w("2", "TABLES");

  // LTYPE テーブル（必須）
  w("0", "TABLE");
  w("2", "LTYPE");
  w("70", "1");
  w("0", "LTYPE");
  w("2", "CONTINUOUS");
  w("70", "0");
  w("3", "");
  w("72", "65");
  w("73", "0");
  w("40", "0.0");
  w("0", "ENDTAB");

  // LAYER テーブル
  const parcelLayers = data.parcels.map((p, i) => ({
    name: safeName(p.parcel_id),
    color: PARCEL_COLORS[i % PARCEL_COLORS.length]!,
  }));
  w("0", "TABLE");
  w("2", "LAYER");
  w("70", parcelLayers.length + 3); // default + parcels + POINTS + REFERENCE
  w("0", "LAYER"); // default layer
  w("2", "0");
  w("70", "0");
  w("62", "7");
  w("6", "CONTINUOUS");
  for (const lay of parcelLayers) {
    w("0", "LAYER");
    w("2", lay.name);
    w("70", "0");
    w("62", lay.color);
    w("6", "CONTINUOUS");
  }
  w("0", "LAYER");
  w("2", "POINTS");
  w("70", "0");
  w("62", "3");
  w("6", "CONTINUOUS");
  w("0", "LAYER");
  w("2", "REFERENCE");
  w("70", "0");
  w("62", "5");
  w("6", "CONTINUOUS");
  w("0", "ENDTAB");

  // STYLE テーブル（TEXT使用に必須）
  w("0", "TABLE");
  w("2", "STYLE");
  w("70", "1");
  w("0", "STYLE");
  w("2", "STANDARD");
  w("70", "0");
  w("40", "0.0");
  w("41", "1.0");
  w("50", "0.0");
  w("71", "0");
  w("42", "0.2");
  w("3", "txt");
  w("4", "");
  w("0", "ENDTAB");

  w("0", "ENDSEC");

  // ── ENTITIES ────────────────────────────────────────────────
  w("0", "SECTION");
  w("2", "ENTITIES");

  for (const parcel of data.parcels) {
    const lname = safeName(parcel.parcel_id);

    // 閉じたポリライン（POLYLINE + VERTEX × N + SEQEND）
    w("0", "POLYLINE");
    w("8", lname);
    w("66", "1"); // vertices-follow flag
    w("70", "1"); // closed
    w("10", "0.0");
    w("20", "0.0");
    for (const c of parcel.coordinates) {
      w("0", "VERTEX");
      w("8", lname);
      w("10", dx(c.y));
      w("20", dy(c.x));
    }
    w("0", "SEQEND");
    w("8", lname);

    // 各測点
    for (const c of parcel.coordinates) {
      w("0", "POINT");
      w("8", "POINTS");
      w("10", dx(c.y));
      w("20", dy(c.x));

      const label = c.marker_type ? `${c.point}(${c.marker_type})` : c.point;
      w("0", "TEXT");
      w("8", lname);
      w("10", (c.y + offset).toFixed(3));
      w("20", (c.x + offset).toFixed(3));
      w("40", th);
      w("1", label);
    }
  }

  // 基準点
  for (const pt of data.reference_points) {
    w("0", "POINT");
    w("8", "REFERENCE");
    w("10", dx(pt.y));
    w("20", dy(pt.x));

    w("0", "TEXT");
    w("8", "REFERENCE");
    w("10", (pt.y + offset).toFixed(3));
    w("20", (pt.x + offset).toFixed(3));
    w("40", th);
    w("1", pt.point);
  }

  // 図面情報テキスト
  const coordSys = data.survey_metadata.coordinate_system ?? "";
  const infos = [
    data.survey_metadata.location_id,
    `${data.survey_metadata.geodetic_system}${coordSys ? ` ${coordSys}` : ""}`,
    data.survey_metadata.survey_date,
  ];
  infos.forEach((text, i) => {
    w("0", "TEXT");
    w("8", "REFERENCE");
    w("10", minDX.toFixed(3));
    w("20", (maxDY + offset * (i + 2)).toFixed(3));
    w("40", th);
    w("1", text);
  });

  w("0", "ENDSEC");
  w("0", "EOF");

  // DXFはCRLF改行が標準
  return L.join("\r\n");
}
