from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.laboratorios.models import Laboratorio

from .services import sincronizar_lugar_de_laboratorio


@receiver(post_save, sender=Laboratorio, dispatch_uid="inventario_lugar_de_laboratorio")
def laboratorio_guardado(sender, instance, raw=False, **kwargs):
    if raw:  # al cargar datos de un archivo (loaddata) no se toca nada más
        return
    sincronizar_lugar_de_laboratorio(instance)
