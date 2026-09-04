"""
SQLAlchemy async database models for TestiFy.
"""
from sqlalchemy import (
    Column, String, Integer, Float, Text, DateTime, ForeignKey, JSON, Boolean
)
from sqlalchemy.orm import DeclarativeBase, relationship
from datetime import datetime
import uuid


def generate_uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


class User(Base):
    """Registered Users."""
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    email = Column(String, nullable=False, unique=True, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(String, default="USER")  # USER | ADMIN
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    issue_reports = relationship("IssueReport", back_populates="user")


class TestSession(Base):
    """Represents a single testing session for a target URL."""
    __tablename__ = "test_sessions"

    id = Column(String, primary_key=True, default=generate_uuid)
    # Display label for the target: the website URL, the GitHub repo URL, or the
    # uploaded archive name. Kept as `url` so every existing view keeps working.
    url = Column(String, nullable=False)
    # url | github | zip — which intake produced this session.
    source_type = Column(String, default="url")
    status = Column(String, default="pending")  # pending | running | completed | failed
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    # Summary statistics
    pages_crawled = Column(Integer, default=0)
    total_issues = Column(Integer, default=0)
    critical_issues = Column(Integer, default=0)
    high_issues = Column(Integer, default=0)
    medium_issues = Column(Integer, default=0)
    low_issues = Column(Integer, default=0)
    performance_score = Column(Float, nullable=True)
    accessibility_score = Column(Float, nullable=True)

    # AI summary
    ai_summary = Column(Text, nullable=True)
    overall_health = Column(String, nullable=True)  # Good | Fair | Poor | Critical

    # Relationships
    issues = relationship("TestIssue", back_populates="session", cascade="all, delete-orphan")
    report = relationship("TestReport", back_populates="session", uselist=False, cascade="all, delete-orphan")


class TestIssue(Base):
    """Represents a single issue found during a test session."""
    __tablename__ = "test_issues"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("test_sessions.id"), nullable=False)

    # Issue classification
    category = Column(String, nullable=False)  # broken_link | js_error | accessibility | performance | form | navigation | ui | api
    severity = Column(String, nullable=False)   # critical | high | medium | low | info
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    recommendation = Column(Text, nullable=True)

    # Location context
    page_url = Column(String, nullable=True)
    element_selector = Column(String, nullable=True)
    screenshot_path = Column(String, nullable=True)

    # Raw data
    raw_data = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("TestSession", back_populates="issues")


class TestReport(Base):
    """Generated report for a completed test session."""
    __tablename__ = "test_reports"

    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("test_sessions.id"), nullable=False)

    html_path = Column(String, nullable=True)
    json_path = Column(String, nullable=True)
    pdf_path = Column(String, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    session = relationship("TestSession", back_populates="report")


class IssueReport(Base):
    """User-submitted issue report (manual user feedback)."""
    __tablename__ = "issue_reports"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=True)

    # Issue details
    title = Column(String, nullable=False)
    description = Column(Text, nullable=False)
    location = Column(String, nullable=False)
    
    # Critical | High | Medium | Low
    severity = Column(String, nullable=False)

    # Evidence
    screenshot_path = Column(String, nullable=True)

    # Lifecycle
    status = Column(String, default="Open")   # Open | In Progress | Resolved | Closed

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    user = relationship("User", back_populates="issue_reports")
