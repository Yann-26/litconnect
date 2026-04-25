from storages.backends.s3boto3 import S3Boto3Storage


class SupabaseStorage(S3Boto3Storage):
    """Custom storage backend that generates Supabase public URLs"""
    
    def url(self, name, parameters=None, expire=None, http_method=None):
        # Call the parent to get the signed URL
        url = super().url(name, parameters, expire, http_method)
        
        # Convert S3 API URL to public URL format
        # From: /storage/v1/s3/bucket/key
        # To: /storage/v1/object/public/bucket/key
        url = url.replace('/storage/v1/s3/', '/storage/v1/object/public/')
        
        return url