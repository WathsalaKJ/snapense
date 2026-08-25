"""Local receipt-image storage.

Files land in ``UPLOAD_FOLDER`` under a per-user subdirectory with a random
name, so uploads cannot collide or leak the original filename into the URL.
Swapping this module for S3 later only means reimplementing ``save_receipt``
and ``delete_receipt``.
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

    Returns ``(absolute_path, relative_path)``. The relative path is what gets
    stored in ``Transaction.receipt_image_url``.
    """
    original = secure_filename(file_storage.filename or "")
    extension = original.rsplit(".", 1)[1].lower() if "." in original else "jpg"
    filename = "{}.{}".format(uuid.uuid4().hex, extension)

    directory = _user_dir(user_id)
    absolute_path = os.path.join(directory, filename)
    file_storage.save(absolute_path)

    relative_path = "{}/{}".format(user_id, filename)
    return absolute_path, relative_path


def absolute_path(relative_path):
    if not relative_path:
        return None
    return os.path.join(_upload_root(), *relative_path.split("/"))


def public_url(relative_path):
    """Build the URL the app uses to fetch a stored receipt."""
    if not relative_path:
        return None
    return url_for("receipts.serve_receipt", path=relative_path, _external=False)


def delete_receipt(relative_path):
    path = absolute_path(relative_path)
    if path and os.path.exists(path):
        try:
            os.remove(path)
            return True
        except OSError:
            return False
    return False
