"""S3-compatible object storage for receipt images (Supabase Storage).

Used when ``STORAGE_PROVIDER=s3``. Supabase Storage exposes an S3-compatible
API, so this talks to it with boto3's regular S3 client rather than a
Supabase-specific SDK -- only the endpoint URL differs from talking to AWS.

The bucket is private: ``get_file_url`` returns a time-limited presigned URL
rather than a public one, generated the same way it would be for AWS S3.
"""

import boto3
from botocore.client import Config as BotoConfig
from flask import current_app

PRESIGNED_URL_EXPIRY_SECONDS = 3600


def _client():
    config = current_app.config
    return boto3.client(
        "s3",
        endpoint_url=config["SUPABASE_S3_ENDPOINT"],
        region_name=config["SUPABASE_S3_REGION"],
        aws_access_key_id=config["SUPABASE_S3_ACCESS_KEY_ID"],
        aws_secret_access_key=config["SUPABASE_S3_SECRET_ACCESS_KEY"],
        # Supabase's S3-compatible endpoint requires path-style addressing
        # (bucket in the path, not as a virtual-hosted subdomain) and only
        # supports SigV4.
        config=BotoConfig(signature_version="s3v4", s3={"addressing_style": "path"}),
    )


def _bucket():
    return current_app.config["SUPABASE_STORAGE_BUCKET"]


def save_file(file_bytes, filename):
    """Upload bytes under ``filename`` (used as the object key) and return that key."""
    _client().put_object(Bucket=_bucket(), Key=filename, Body=file_bytes)
    return filename


def get_file_url(key, expires_in=PRESIGNED_URL_EXPIRY_SECONDS):
    """Return a presigned URL the frontend can use to display the image."""
    if not key:
        return None
    return _client().generate_presigned_url(
        "get_object",
        Params={"Bucket": _bucket(), "Key": key},
        ExpiresIn=expires_in,
    )


def delete_file(key):
    if not key:
        return False
    _client().delete_object(Bucket=_bucket(), Key=key)
    return True
