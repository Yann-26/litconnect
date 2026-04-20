# admissions/models.py
from django.db import models

class Application(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    # Student Details
    name = models.CharField(max_length=255)
    country = models.CharField(max_length=100)
    phone = models.CharField(max_length=20)
    email = models.EmailField()
    course = models.CharField(max_length=100)
    
    # Status & Metadata
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    # Document Files (Use FileField instead of URLField)
    nrc = models.FileField(upload_to='documents/nrc/', blank=True, null=True)
    transcript = models.FileField(upload_to='documents/transcripts/', blank=True, null=True)
    photo = models.FileField(upload_to='documents/photos/', blank=True, null=True)
    other = models.FileField(upload_to='documents/others/', blank=True, null=True)

    def __str__(self):
        return f"{self.name} - {self.course}"