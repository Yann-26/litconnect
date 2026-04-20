# admissions/admin.py
from django.contrib import admin
from .models import Application

@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ['name', 'country', 'course', 'status', 'created_at']
    list_filter = ['status', 'course', 'country']
    search_fields = ['name', 'email', 'phone']
    readonly_fields = ['created_at']
    
    fieldsets = (
        ('Student Information', {
            'fields': ('name', 'country', 'phone', 'email', 'course')
        }),
        ('Documents', {
            'fields': ('nrc', 'transcript', 'photo', 'other')
        }),
        ('Status', {
            'fields': ('status', 'created_at')
        }),
    )