import django_filters
from django.utils import timezone

from .models import BloqueReserva, Reserva


class ReservaFilter(django_filters.FilterSet):
    laboratorio = django_filters.NumberFilter(method="filtrar_laboratorio")
    desde = django_filters.DateFilter(method="filtrar_desde")
    hasta = django_filters.DateFilter(method="filtrar_hasta")
    cuando = django_filters.ChoiceFilter(
        choices=[("proximas", "Próximas"), ("pasadas", "Pasadas")], method="filtrar_cuando"
    )

    class Meta:
        model = Reserva
        fields = ["estado", "requiere_apoyo", "solicitante"]

    def _con_bloques(self, queryset, **filtros):
        ids = BloqueReserva.objects.filter(**filtros).values("reserva_id")
        return queryset.filter(id__in=ids)

    def filtrar_laboratorio(self, queryset, name, value):
        return self._con_bloques(queryset, laboratorio_id=value)

    def filtrar_desde(self, queryset, name, value):
        return self._con_bloques(queryset, fin__date__gte=value)

    def filtrar_hasta(self, queryset, name, value):
        return self._con_bloques(queryset, inicio__date__lte=value)

    def filtrar_cuando(self, queryset, name, value):
        ahora = timezone.now()
        if value == "proximas":
            return self._con_bloques(queryset, fin__gte=ahora)
        return queryset.exclude(id__in=BloqueReserva.objects.filter(fin__gte=ahora).values("reserva_id"))
