from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
import os

from database.db import get_db
from database.models import User, IssueReport, TestSession, TestIssue, TestReport
from routers.auth import get_current_admin
from routers.issues import _serialize as serialize_issue

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/users")
async def get_all_users(db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    result = await db.execute(select(User).order_by(User.created_at.desc()))
    users = result.scalars().all()
    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None
        }
        for u in users
    ]

@router.get("/issues")
async def get_all_user_issues(db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    # Same as normal issues, but maybe we could attach user info here in the future
    # Using existing serialization for consistency
    result = await db.execute(select(IssueReport).order_by(IssueReport.created_at.desc()))
    issues = result.scalars().all()
    return [serialize_issue(i) for i in issues]

@router.get("/stats")
async def get_admin_stats(db: AsyncSession = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    # Basic counts for admin dashboard
    user_count = await db.execute(select(func.count(User.id)))
    issue_report_count = await db.execute(select(func.count(IssueReport.id)))
    session_count = await db.execute(select(func.count(TestSession.id)))
    bug_count = await db.execute(select(func.count(TestIssue.id)))
    
    return {
        "users": user_count.scalar() or 0,
        "user_issues": issue_report_count.scalar() or 0,
        "sessions": session_count.scalar() or 0,
        "automated_bugs": bug_count.scalar() or 0
    }
