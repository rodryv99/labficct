class AuditoriaMixin:
    """Guarda quién creó y quién modificó cada registro."""

    def perform_create(self, serializer):
        serializer.save(creado_por=self.request.user, actualizado_por=self.request.user)

    def perform_update(self, serializer):
        serializer.save(actualizado_por=self.request.user)
