#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;

use libmpv_sys::*;
use napi::{Error, Result, Status};
use serde::{Deserialize, Serialize};
use std::ffi::{CStr, CString};
use std::ptr;
use std::sync::{Arc, Mutex};

// Wrapper to make the raw pointer thread-safe
struct MpvHandle(*mut mpv_handle);
unsafe impl Send for MpvHandle {}
unsafe impl Sync for MpvHandle {}
// Global mpv instance
static MPV_INSTANCE: Mutex<Option<MpvHandle>> = Mutex::new(None);

#[derive(Serialize, Deserialize)]
#[napi(object)]
pub struct PlaybackState {
  pub playing: bool,
  pub current_time: f64,
  pub duration: f64,
  pub volume: f64,
  pub speed: f64,
}

#[napi]
pub fn media_init() -> Result<bool> {
  let mut instance = MPV_INSTANCE.lock().unwrap();

  if instance.is_some() {
    return Ok(true);
  }

  unsafe {
    let mpv = mpv_create();
    if mpv.is_null() {
      return Err(Error::new(
        Status::GenericFailure,
        "Failed to create mpv instance",
      ));
    }

    // Configure mpv
    let idle = CString::new("idle").unwrap();
    let yes = CString::new("yes").unwrap();
    mpv_set_option_string(mpv, idle.as_ptr(), yes.as_ptr());

    let keep_open = CString::new("keep-open").unwrap();
    mpv_set_option_string(mpv, keep_open.as_ptr(), yes.as_ptr());

    // Initialize
    let result = mpv_initialize(mpv);
    if result < 0 {
      mpv_destroy(mpv);
      return Err(Error::new(
        Status::GenericFailure,
        format!("Failed to initialize mpv: {}", result),
      ));
    }

    *instance = Some(MpvHandle(mpv));
    Ok(true)
  }
}

#[napi]
pub fn media_play_pause() -> Result<bool> {
  let instance = MPV_INSTANCE.lock().unwrap();

  if let Some(MpvHandle(mpv)) = instance.as_ref() {
    unsafe {
      // Get current pause state
      let pause_prop = CString::new("pause").unwrap();
      let mut is_paused: i64 = 0;
      let result = mpv_get_property(
        *mpv,
        pause_prop.as_ptr(),
        mpv_format_MPV_FORMAT_FLAG,
        &mut is_paused as *mut _ as *mut std::ffi::c_void,
      );

      if result == 0 {
        // Toggle pause state
        let mut new_state = if is_paused != 0 { 0i64 } else { 1i64 };
        let set_result = mpv_set_property(
          *mpv,
          pause_prop.as_ptr(),
          mpv_format_MPV_FORMAT_FLAG,
          &mut new_state as *mut _ as *mut std::ffi::c_void,
        );
        Ok(set_result == 0)
      } else {
        Err(Error::new(
          Status::GenericFailure,
          format!("Failed to get pause state: {}", result),
        ))
      }
    }
  } else {
    Err(Error::new(Status::GenericFailure, "mpv not initialized"))
  }
}

#[napi]
pub fn media_load_video(file_path: String) -> Result<bool> {
  let instance = MPV_INSTANCE.lock().unwrap();

  if let Some(MpvHandle(mpv)) = instance.as_ref() {
    unsafe {
      let loadfile = CString::new("loadfile").unwrap();
      let path = CString::new(file_path).unwrap();

      // Create command arguments array
      let mut args = [loadfile.as_ptr(), path.as_ptr(), ptr::null()];

      let result = mpv_command(*mpv, args.as_mut_ptr());
      if result == 0 {
        Ok(true)
      } else {
        Err(Error::new(
          Status::GenericFailure,
          format!("Failed to load video: {}", result),
        ))
      }
    }
  } else {
    Err(Error::new(Status::GenericFailure, "mpv not initialized"))
  }
}

#[napi]
pub fn media_get_state() -> Result<PlaybackState> {
  let instance = MPV_INSTANCE.lock().unwrap();

  if let Some(MpvHandle(mpv)) = instance.as_ref() {
    unsafe {
      // Get pause state
      let pause_prop = CString::new("pause").unwrap();
      let mut is_paused: i64 = 1;
      mpv_get_property(
        *mpv,
        pause_prop.as_ptr(),
        mpv_format_MPV_FORMAT_FLAG,
        &mut is_paused as *mut _ as *mut std::ffi::c_void,
      );
      let playing = is_paused == 0;

      // Get time position
      let time_prop = CString::new("time-pos").unwrap();
      let mut current_time: f64 = 0.0;
      mpv_get_property(
        *mpv,
        time_prop.as_ptr(),
        mpv_format_MPV_FORMAT_DOUBLE,
        &mut current_time as *mut _ as *mut std::ffi::c_void,
      );

      // Get duration
      let duration_prop = CString::new("duration").unwrap();
      let mut duration: f64 = 0.0;
      mpv_get_property(
        *mpv,
        duration_prop.as_ptr(),
        mpv_format_MPV_FORMAT_DOUBLE,
        &mut duration as *mut _ as *mut std::ffi::c_void,
      );

      // Get volume
      let volume_prop = CString::new("volume").unwrap();
      let mut volume: f64 = 100.0;
      mpv_get_property(
        *mpv,
        volume_prop.as_ptr(),
        mpv_format_MPV_FORMAT_DOUBLE,
        &mut volume as *mut _ as *mut std::ffi::c_void,
      );

      // Get speed
      let speed_prop = CString::new("speed").unwrap();
      let mut speed: f64 = 1.0;
      mpv_get_property(
        *mpv,
        speed_prop.as_ptr(),
        mpv_format_MPV_FORMAT_DOUBLE,
        &mut speed as *mut _ as *mut std::ffi::c_void,
      );

      Ok(PlaybackState {
        playing,
        current_time,
        duration,
        volume,
        speed,
      })
    }
  } else {
    Err(Error::new(Status::GenericFailure, "mpv not initialized"))
  }
}
#[napi]
pub fn media_seek(position: f64) -> Result<bool> {
  let instance = MPV_INSTANCE.lock().unwrap();

  if let Some(MpvHandle(mpv)) = instance.as_ref() {
    unsafe {
      let time_prop = CString::new("time-pos").unwrap();
      let mut pos = position;
      let result = mpv_set_property(
        *mpv,
        time_prop.as_ptr(),
        mpv_format_MPV_FORMAT_DOUBLE,
        &mut pos as *mut _ as *mut std::ffi::c_void,
      );

      if result == 0 {
        Ok(true)
      } else {
        Err(Error::new(
          Status::GenericFailure,
          format!("Failed to seek: {}", result),
        ))
      }
    }
  } else {
    Err(Error::new(Status::GenericFailure, "mpv not initialized"))
  }
}
#[napi]
pub fn hello_from_rust() -> String {
  "Hello from Rust! 🦀".to_string()
}

#[napi]
pub fn get_system_info() -> String {
  format!("Running on {} architecture", std::env::consts::ARCH)
}
