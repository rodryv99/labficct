from django.db.models import Count, Min, Prefetch, Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core import atencion
from apps.core.errores import ErrorNegocio
from apps.core.mixins import AuditoriaMixin
from apps.core.permissions import TienePermiso, permisos_crud
from apps.core.roles import Rol

from . import selectors, services
from .filters import ReservaFilter
from .models import (
    BloqueReserva,
    Docente,
    EstadoReserva,
    ExcepcionHorario,
    Horario,
    Materia,
    PeriodoAcademico,
    Reserva,
)
from .serializers import (
    CancelarReservaSerializer,
    ClonarHorariosRespuestaSerializer,
    ClonarHorariosSerializer,
    DisponibilidadRespuestaSerializer,
    DisponibilidadSerializer,
    DocenteSerializer,
    EventoAgendaSerializer,
    ExcepcionSerializer,
    HorarioLoteEditarSerializer,
    HorarioLoteSerializer,
    HorarioSerializer,
    MateriaSerializer,
    PeriodoSerializer,
    ReservaSerializer,
    SuspenderClaseSerializer,
)


class PeriodoViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    queryset = PeriodoAcademico.objects.annotate(total_horarios=Count("horarios", filter=Q(horarios__activo=True)))
    serializer_class = PeriodoSerializer
    permission_classes = [TienePermiso]
    permisos = permisos_crud("horarios.ver", "horarios.gestionar", clonar_horarios="horarios.gestionar")
    pagination_class = None
    filterset_fields = ["vigente"]

    @extend_schema(request=ClonarHorariosSerializer, responses=ClonarHorariosRespuestaSerializer)
    @action(detail=True, methods=["post"], url_path="clonar-horarios")
    def clonar_horarios(self, request, pk=None):
        """Copia las clases activas de este periodo a otro (p. ej. de 2-2026 a 1-2027)."""
        serializer = ClonarHorariosSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        resultado = services.clonar_horarios(
            origen=self.get_object(), destino=serializer.validated_data["destino"], usuario=request.user
        )
        return Response(resultado)


class DocenteViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    """Docentes, con o sin usuario. Los horarios se asignan a estas fichas."""

    serializer_class = DocenteSerializer
    permission_classes = [TienePermiso]
    permisos = permisos_crud("horarios.ver", "horarios.gestionar")
    pagination_class = None
    filterset_fields = ["activo"]
    search_fields = ["nombres", "apellidos", "email"]

    def get_queryset(self):
        qs = Docente.objects.select_related("usuario").annotate(total_horarios=Count("horarios"))
        sin_usuario = self.request.query_params.get("sin_usuario")
        if sin_usuario in ("1", "true"):
            qs = qs.filter(usuario__isnull=True)
        return qs


class MateriaViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    queryset = Materia.objects.all()
    serializer_class = MateriaSerializer
    permission_classes = [TienePermiso]
    permisos = permisos_crud("horarios.ver", "horarios.gestionar")
    pagination_class = None
    search_fields = ["sigla", "nombre"]


class HorarioViewSet(viewsets.ModelViewSet):
    """4. Horarios: clases que se repiten cada semana."""

    serializer_class = HorarioSerializer
    permission_classes = [TienePermiso]
    permisos = permisos_crud(
        "horarios.ver",
        "horarios.gestionar",
        suspender="horarios.gestionar",
        reanudar="horarios.gestionar",
        lote="horarios.gestionar",
        editar_lote="horarios.gestionar",
    )
    filterset_fields = ["periodo", "laboratorio", "dia_semana", "docente", "activo"]
    search_fields = ["materia__sigla", "materia__nombre", "grupo", "docente__nombres", "docente__apellidos"]
    ordering_fields = ["dia_semana", "hora_inicio", "materia__sigla", "laboratorio__codigo"]
    ordering = ["dia_semana", "hora_inicio"]

    def get_queryset(self):
        qs = Horario.objects.select_related("periodo", "laboratorio", "materia", "docente")
        if self.request.user.rol == Rol.DOCENTE:
            qs = qs.filter(docente__usuario=self.request.user)
        return qs

    @extend_schema(request=HorarioLoteSerializer, responses=HorarioSerializer(many=True))
    @action(detail=False, methods=["post"])
    def lote(self, request):
        """Crea la misma clase en varios días: {"dias": [1, 3, 5], ...}. Todo o nada."""
        serializer = HorarioLoteSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        datos = dict(serializer.validated_data)
        dias = datos.pop("dias")
        datos.pop("dia_semana", None)
        horarios = services.crear_horarios_por_dias(datos=datos, dias=dias, usuario=request.user)
        return Response(HorarioSerializer(horarios, many=True).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=HorarioLoteEditarSerializer, responses=HorarioSerializer(many=True))
    @action(detail=False, methods=["post"], url_path="lote/editar")
    def editar_lote(self, request):
        """Edita una clase de varios días (una fila de la tabla): {"ids": [...], "dias": [1, 3], ...}.
        Los días que se quitan se borran y los nuevos se crean. Todo o nada."""
        ids = request.data.get("ids") if isinstance(request.data, dict) else None
        ids = {int(i) for i in ids if str(i).isdigit()} if isinstance(ids, list) else set()
        horarios = list(self.get_queryset().filter(pk__in=ids))
        if not ids or len(horarios) != len(ids):
            raise ErrorNegocio(
                "Esa clase cambió mientras la editabas. Recarga la página e inténtalo de nuevo.",
                codigo="horarios_inexistentes",
            )
        serializer = HorarioLoteEditarSerializer(
            data=request.data, context={**self.get_serializer_context(), "horarios": horarios}
        )
        serializer.is_valid(raise_exception=True)
        datos = dict(serializer.validated_data)
        dias = datos.pop("dias")
        datos.pop("ids")
        datos.pop("dia_semana", None)
        horarios = services.editar_horarios_por_dias(
            horarios=horarios, datos=datos, dias=dias, usuario=request.user
        )
        return Response(HorarioSerializer(horarios, many=True).data)

    def perform_create(self, serializer):
        serializer.instance = services.guardar_horario(
            horario=None, datos=serializer.validated_data, usuario=self.request.user
        )

    def perform_update(self, serializer):
        serializer.instance = services.guardar_horario(
            horario=serializer.instance, datos=serializer.validated_data, usuario=self.request.user
        )

    @extend_schema(request=SuspenderClaseSerializer, responses=ExcepcionSerializer)
    @action(detail=True, methods=["post"])
    def suspender(self, request, pk=None):
        """Suspende la clase solo en una fecha (feriado, actividad, etc.)."""
        serializer = SuspenderClaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        excepcion = services.suspender_clase(
            horario=self.get_object(), usuario=request.user, **serializer.validated_data
        )
        return Response(ExcepcionSerializer(excepcion).data, status=status.HTTP_201_CREATED)

    @extend_schema(request=SuspenderClaseSerializer, responses={204: None})
    @action(detail=True, methods=["post"])
    def reanudar(self, request, pk=None):
        serializer = SuspenderClaseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.reanudar_clase(horario=self.get_object(), fecha=serializer.validated_data["fecha"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class ReservaViewSet(viewsets.ModelViewSet):
    """5. Reservas: eventos únicos o de pocos días. No se borran: se cancelan."""

    serializer_class = ReservaSerializer
    permission_classes = [TienePermiso]
    permisos = permisos_crud(
        "reservas.ver", "reservas.gestionar", cancelar="reservas.gestionar", aprobar="reservas.aprobar"
    )
    http_method_names = ["get", "post", "put", "patch", "head", "options"]
    filterset_class = ReservaFilter
    search_fields = ["titulo", "descripcion", "solicitante_externo", "solicitante__nombres", "solicitante__apellidos"]
    ordering_fields = ["primer_inicio", "creado_en", "titulo"]
    ordering = ["-primer_inicio"]

    def get_queryset(self):
        bloques = BloqueReserva.objects.select_related("laboratorio")
        suspendidas = ExcepcionHorario.objects.select_related(
            "horario__materia", "horario__docente", "horario__laboratorio"
        ).order_by("fecha", "horario__hora_inicio")
        qs = (
            Reserva.objects.select_related("solicitante", "creado_por", "aprobada_por")
            .prefetch_related(
                "programas",
                "auxiliares",
                Prefetch("bloques", queryset=bloques),
                Prefetch("clases_suspendidas", queryset=suspendidas),
            )
            .annotate(primer_inicio=Min("bloques__inicio"))
        )
        if self.request.user.rol == Rol.DOCENTE:
            qs = qs.filter(solicitante=self.request.user)
        return qs

    def _respuesta(self, reserva, avisos, codigo):
        reserva = self.get_queryset().get(pk=reserva.pk)
        reserva._advertencias = avisos
        return Response(self.get_serializer(reserva).data, status=codigo)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reserva, avisos = services.guardar_reserva(
            reserva=None, datos=serializer.validated_data, usuario=request.user
        )
        return self._respuesta(reserva, avisos, status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        parcial = kwargs.pop("partial", False)
        instancia = self.get_object()
        if instancia.estado == EstadoReserva.CANCELADA:
            raise ErrorNegocio("Una reserva cancelada no se puede editar.", codigo="reserva_cancelada")
        serializer = self.get_serializer(instancia, data=request.data, partial=parcial)
        serializer.is_valid(raise_exception=True)
        reserva, avisos = services.guardar_reserva(
            reserva=instancia, datos=serializer.validated_data, usuario=request.user
        )
        return self._respuesta(reserva, avisos, status.HTTP_200_OK)

    @extend_schema(request=CancelarReservaSerializer, responses=ReservaSerializer)
    @action(detail=True, methods=["post"])
    def cancelar(self, request, pk=None):
        serializer = CancelarReservaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reserva = services.cancelar_reserva(
            reserva=self.get_object(), motivo=serializer.validated_data["motivo"], usuario=request.user
        )
        return self._respuesta(reserva, [], status.HTTP_200_OK)

    @extend_schema(request=None, responses=ReservaSerializer)
    @action(detail=True, methods=["post"])
    def aprobar(self, request, pk=None):
        """Aprueba una reserva por aprobar: tiene prioridad y las clases con las que
        choca se suspenden esos días (quedan en `clases_suspendidas`)."""
        reserva = services.aprobar_reserva(reserva=self.get_object(), usuario=request.user)
        return self._respuesta(reserva, [], status.HTTP_200_OK)


def _fecha(valor, por_defecto):
    try:
        return parse_date(valor or "") or por_defecto
    except ValueError as error:
        raise ErrorNegocio("Fecha inválida. Usa el formato AAAA-MM-DD.", codigo="fecha_invalida") from error


class AgendaView(APIView):
    """6. Pizarra: clases y reservas de un rango de fechas, en una sola lista."""

    permission_classes = [TienePermiso]
    permisos = {"get": "pizarra.ver"}

    @extend_schema(
        parameters=[
            OpenApiParameter("desde", OpenApiTypes.DATE, description="Por defecto, hoy."),
            OpenApiParameter("hasta", OpenApiTypes.DATE, description="Por defecto, igual a desde."),
            OpenApiParameter("laboratorio", str, description="IDs separados por coma."),
        ],
        responses=EventoAgendaSerializer(many=True),
    )
    def get(self, request):
        desde = _fecha(request.query_params.get("desde"), timezone.localdate())
        hasta = _fecha(request.query_params.get("hasta"), desde)
        laboratorios = [
            int(x) for x in request.query_params.get("laboratorio", "").split(",") if x.strip().isdigit()
        ]
        eventos = selectors.agenda(desde=desde, hasta=hasta, laboratorios=laboratorios or None)
        return Response(EventoAgendaSerializer(eventos, many=True).data)


class DisponibilidadView(APIView):
    """Revisa si un laboratorio está libre, sin guardar nada (para validar en vivo)."""

    permission_classes = [TienePermiso]
    permisos = {"post": "reservas.gestionar"}

    @extend_schema(request=DisponibilidadSerializer, responses=DisponibilidadRespuestaSerializer)
    def post(self, request):
        serializer = DisponibilidadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        if d["hora_fin"] <= d["hora_inicio"]:
            raise ErrorNegocio("La hora de fin debe ser posterior a la de inicio.", codigo="horas_invalidas")
        fuera = atencion.mensaje_fuera_de_atencion(d["hora_inicio"], d["hora_fin"])
        if fuera:
            # Esto sí impide guardar.
            return Response({"disponible": False, "choques": [fuera], "requiere_aprobacion": False})
        inicio = services._local(d["fecha"], d["hora_inicio"])
        fin = services._local(d["fecha"], d["hora_fin"])
        choques = services.choques_de_bloque(
            laboratorio=d["laboratorio"], inicio=inicio, fin=fin, excluir_reserva_id=d.get("excluir_reserva")
        )
        # Un choque no impide guardar: la reserva queda por aprobar.
        return Response({"disponible": not choques, "choques": choques, "requiere_aprobacion": bool(choques)})
