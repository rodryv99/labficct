import { api } from "../../api/client";
import { ENDPOINTS } from "../../api/endpoints";
import type { EstadoRespaldos, Respaldo } from "../../api/tipos";

export async function estadoRespaldos() {
  const { data } = await api.get<EstadoRespaldos>(ENDPOINTS.respaldos.estado);
  return data;
}

export async function listarRespaldos() {
  const { data } = await api.get<Respaldo[]>(ENDPOINTS.respaldos.lista);
  return data;
}

export async function generarRespaldo(nota = "") {
  const { data } = await api.post<Respaldo>(ENDPOINTS.respaldos.generar, { nota });
  return data;
}

export async function eliminarRespaldo(id: number) {
  await api.delete(ENDPOINTS.respaldos.eliminar(id));
}

/** Descarga el archivo .sql de un respaldo al equipo. */
export async function descargarRespaldo(respaldo: Respaldo) {
  const resp = await api.get<Blob>(ENDPOINTS.respaldos.descargar(respaldo.id), { responseType: "blob" });
  const url = URL.createObjectURL(resp.data);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = respaldo.archivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
