"""Fail-closed checks for satellite pixel resolution and grid size."""
import pathlib
import sys
import pytest

sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'worker'))
from analyze import target_grid


def test_ordinary_test_area_preserves_10_m_spatial_detail():
    transform,width,height=target_grid([8.2,7.6,8.25,7.65])
    assert 400 < width < 800
    assert 400 < height < 800
    assert 9.8 < transform.a <= 10
    assert 9.8 < abs(transform.e) <= 10


def test_larger_area_cannot_silently_downsample_satellite_data():
    with pytest.raises(ValueError,match='smaller bounding box'):
        target_grid([8.2,7.6,8.4,7.8])


def test_very_small_area_has_valid_grid():
    transform,width,height=target_grid([8.20,7.60,8.201,7.601])
    assert width>=32 and height>=32
    assert transform.a>0
    assert transform.e<0
