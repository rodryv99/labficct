FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Cliente de PostgreSQL 18 (pg_dump), que usan los respaldos de la base de datos.
# Se instala desde el repositorio oficial PGDG para que la versión coincida con
# la del servidor (postgres:18). El nombre del sistema (bookworm/trixie) se detecta
# solo, así funciona con cualquier base de python:3.13-slim.
#
# El paso es "best-effort": si no se puede instalar (por ejemplo, sin acceso a la
# red del repositorio), la imagen igual se construye y la app funciona; solo los
# respaldos quedan deshabilitados hasta reconstruir con red. La pantalla de
# Respaldos avisa cuando falta pg_dump.
RUN set -eux; \
    ( apt-get update \
      && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
      && install -d /usr/share/postgresql-common/pgdg \
      && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
          -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
      && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(. /etc/os-release && echo $VERSION_CODENAME)-pgdg main" \
          > /etc/apt/sources.list.d/pgdg.list \
      && apt-get update \
      && apt-get install -y --no-install-recommends postgresql-client-18 \
      && apt-get purge -y --auto-remove curl gnupg ) \
    || echo "AVISO: no se pudo instalar postgresql-client-18; los respaldos quedaran deshabilitados hasta reconstruir con red."; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements/ requirements/
RUN pip install --no-cache-dir -r requirements/dev.txt

COPY . .

EXPOSE 8000
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
