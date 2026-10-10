from celery import shared_task


@shared_task(name="bitacora.revisiones_vencidas")
def revisiones_vencidas():
    from .services import revisiones_vencidas as revisar

    return revisar()
