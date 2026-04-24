# admissions/views.py
import json
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

import os

import supabase

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

from .models import Application
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required, user_passes_test
from supabase import create_client


if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Supabase credentials missing. Check your .env file.")

def get_supabase():
    return create_client(
        os.getenv("SUPABASE_URL"),
        os.getenv("SUPABASE_KEY")
    )

def get_signed_url(path):
    if not path:
        return None
    
    supabase = get_supabase()
    
    res = supabase.storage.from_("litconnect").create_signed_url(
        path,
        60
    )
    return res.get("signedURL")


# Helper function to check if user is staff
def is_staff(user):
    return user.is_staff

def home(request):
    """Serves the main index.html file."""
    return render(request, "index.html")

@csrf_exempt
def submit_application(request):
    """Processes the student form (Text + Files) and saves to MongoDB."""
    if request.method == 'POST':
        try:
            # Create the record using data from request.POST and files from request.FILES
            new_app = Application.objects.create(
                name=request.POST.get('name'),
                country=request.POST.get('country'),
                phone=request.POST.get('phone'),
                email=request.POST.get('email'),
                course=request.POST.get('course'),
                # Handle file uploads
                nrc=request.FILES.get('nrc'),
                transcript=request.FILES.get('transcript'),
                photo=request.FILES.get('photo'),
                other=request.FILES.get('other')
            )
            return JsonResponse({'status': 'success', 'id': str(new_app.id)})
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
    return JsonResponse({'status': 'error', 'message': 'Invalid method'}, status=400)


@login_required
@user_passes_test(is_staff)
def get_applications(request):
    """Only logged-in staff can see the applicant list."""
    apps = []
    # Using .url from the FileField uses Boto3 to generate the URL instantly 
    # without making an external HTTP request.
    for app in Application.objects.all().order_by('-created_at'):
        app_dict = {
            'id': str(app.id),
            'name': app.name,
            'country': app.country,
            'phone': app.phone,
            'email': app.email,
            'course': app.course,
            'status': app.status,
            'created_at': app.created_at.isoformat(),
            
            # Instantly grab the URLs via Django's storage backend
            'nrc_url': app.nrc.url if app.nrc else None,
            'transcript_url': app.transcript.url if app.transcript else None,
            'photo_url': app.photo.url if app.photo else None,
            'other_url': app.other.url if app.other else None,
        }
        apps.append(app_dict)
    
    return JsonResponse(apps, safe=False)


@login_required
@user_passes_test(is_staff)
def update_status(request, app_id):
    """Only logged-in staff can approve or reject applications."""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            new_status = data.get('status')
            
            app = Application.objects.get(id=app_id)
            app.status = new_status
            app.save()
            
            return JsonResponse({'status': 'success'})
        except Application.DoesNotExist:
            return JsonResponse({'status': 'error', 'message': 'Not found'}, status=404)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)


@csrf_exempt
def admin_login(request):
    """Handle admin login."""
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            username = data.get('username')
            password = data.get('password')
            
            user = authenticate(request, username=username, password=password)
            
            if user is not None and user.is_staff:
                login(request, user)
                return JsonResponse({
                    'status': 'success',
                    'user': {
                        'username': user.username,
                        'is_staff': user.is_staff
                    }
                })
            else:
                return JsonResponse({
                    'status': 'error',
                    'message': 'Invalid credentials or insufficient permissions'
                }, status=401)
        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
    return JsonResponse({'status': 'error', 'message': 'Invalid method'}, status=400)

@login_required
def admin_logout(request):
    """Handle admin logout."""
    logout(request)
    return JsonResponse({'status': 'success'})