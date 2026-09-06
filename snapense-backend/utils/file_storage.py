"""Receipt-image storage.

``STORAGE_PROVIDER=local`` (the default) saves files in ``UPLOAD_FOLDER``
under a per-user subdirectory with a random name, so uploads cannot collide
or leak the original filename into the URL. ``STORAGE_PROVIDER=s3`` routes
the same operations through ``services/storage_service.py`` (Supabase
Storage's S3-compatible API) instead, for deployments with an ephemeral
filesystem.
"""

import os
import uuid

from flask import current_app, url_for
from werkzeug.utils import secure_filename


def allowed_file(filename):
    if not filename or "." not in filename:
        return False
    extension = filename.rsplit(".", 1)[1].lower()
    return extension in current_app.config["ALLOWED_EXTENSIONS"]


def _using_s3():
    return current_app.config.get("STORAGE_PROVIDER") == "s3"


def _upload_root():
    root = current_app.config["UPLOAD_FOLDER"]
    os.makedirs(root, exist_ok=True)
    return root


def _user_dir(user_id):
    path = os.path.join(_upload_root(), str(user_id))
    os.makedirs(path, exist_ok=True)
    return path


def save_receipt(file_storage, user_id):
    """Persist an uploaded receipt.

    Returns ``(absolute_path, relative_path)``. ``relative_path`` is what gets
    stored in ``Transaction.receipt_image_url`` (a local path under
    ``STORAGE_PROVIDER=local``, an S3 object key under ``STORAGE_PROVIDER=s3``).
    ``absolute_path`` is only meaningful for local storage; it is ``None``
    under ``STORAGE_PROVIDER=s3``, since there is no local file.
    """
    original = secure_filename(file_storage.filename or "")
    extension = original.rsplit(".", 1)[1].lower() if "." in original else "jpg"
    filename = "{}.{}".format(uuid.uuid4().hex, extension)
    relative_path = "{}/{}".format(user_id, filename)

    if _using_s3():
        from services import storage_service

        storage_service.save_file(file_storage.read(), relative_path)
        return None, relative_path

    directory = _user_dir(user_id)
    absolute_path = os.path.join(directory, filename)
    file_storage.save(absolute_path)
    return absolute_path, relative_path


def absolute_path(relative_path):
    if not relative_path:
        return None
    return os.path.join(_upload_root(), *relative_path.split("/"))


def public_url(relative_path):
    """Build the URL the app uses to fetch a stored receipt.

    Under ``STORAGE_PROVIDER=s3`` this is a time-limited presigned URL from
    Supabase Storage; under ``STORAGE_PROVIDER=local`` it is the app's own
    ``serve_receipt`` route.
    """
    if not relative_path:
        return None

    if _using_s3():
        from services import storage_service

        return storage_service.get_file_url(relative_path)

    return url_for("receipts.serve_receipt", path=relative_path, _external=False)


def delete_receipt(relative_path):
    if not relative_path:
        return False

    if _using_s3():
        from services import storage_service

        return storage_service.delete_file(relative_path)

    path = absolute_path(relative_path)
    if path and os.path.exists(path):
        try:
            os.remove(path)
            return True
        except OSError:
            return False
    return False
