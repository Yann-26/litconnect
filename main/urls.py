from django.urls import path
from . import views

urlpatterns = [
    path('', views.home, name='home'),
    path('api/submit/', views.submit_application, name='submit_appli'),
    path('api/applications/', views.get_applications),
    path('api/applications/<int:app_id>/update/', views.update_status),
]