"""Prueba del motor de exportación (no usa la base de datos)."""

from apps.reportes import base, exportacion


def _resultado_demo() -> base.Resultado:
    return base.Resultado(
        columnas=[
            base.Columna("lab", "Laboratorio", base.TEXTO, 2),
            base.Columna("n", "Reservas", base.NUMERO, 1),
        ],
        filas=[["Lab A", 12], ["Lab B", 7], ["Lab C", 19]],
        kpis=[base.KPI("Total", "38", "info"), base.KPI("Promedio", "12.7", "marca")],
        graficos=[
            base.Grafico(base.BARRAS, "Reservas por laboratorio",
                         etiquetas=["Lab A", "Lab B", "Lab C"], series=[base.serie("Reservas", [12, 7, 19])]),
            base.Grafico(base.DONA, "Distribución",
                         etiquetas=["A", "B", "C"], series=[base.serie("n", [12, 7, 19])]),
        ],
    )


def test_cuatro_formatos_se_generan():
    res = _resultado_demo()
    magia = {
        "xlsx": b"PK\x03\x04",
        "csv": b"\xef\xbb\xbf",  # marca UTF-8
        "pdf": b"%PDF",
        "docx": b"PK\x03\x04",
    }
    for formato, inicio in magia.items():
        contenido, mime, nombre = exportacion.exportar("demo", "Reporte demo", "16/11/2026", res, formato)
        assert contenido[: len(inicio)] == inicio, formato
        assert nombre == f"demo.{formato}"
        assert formato in mime or "spreadsheet" in mime or "wordprocessing" in mime


def test_sin_datos_no_falla():
    vacio = base.Resultado(columnas=[base.Columna("x", "X")], filas=[], kpis=[], graficos=[])
    for formato in ("xlsx", "csv", "pdf", "docx"):
        contenido, _mime, _nombre = exportacion.exportar("vacio", "Vacío", "", vacio, formato)
        assert len(contenido) > 0


def test_formato_invalido_lanza_error():
    from apps.core.errores import ErrorNegocio

    try:
        exportacion.exportar("x", "X", "", _resultado_demo(), "rtf")
    except ErrorNegocio as e:
        assert e.codigo == "formato_invalido"
    else:
        raise AssertionError("debió lanzar ErrorNegocio")
